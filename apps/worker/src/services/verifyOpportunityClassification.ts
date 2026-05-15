/**
 * verifyOpportunityClassification — second-pass DeepSeek classifier that
 * sanity-checks items the topic mapper labelled `opportunity` or
 * `scholarship`.
 *
 * Why this exists:
 *   The first-pass classifier is keyword-based (`category === "programmes"`,
 *   `vertical === "opportunites"`, etc). It gets fooled by general news
 *   articles that the upstream Gemini topic tagger mislabelled — we saw an
 *   Iran/US "ceasefire" story slip into the Threads opportunity feed because
 *   the word "accord" triggered the `programmes` tag. With a +65 base score
 *   that hijacked the queue.
 *
 *   This module asks DeepSeek a single question: "Is this article a real,
 *   actionable opportunity (deadline + how to apply), or is it news ABOUT
 *   an opportunity, or is it general news?" When the answer is "news",
 *   we demote the topic so the score falls below the Threads threshold
 *   and the item drops out of the queue.
 *
 * Cost guardrails:
 *   - Only verifies items already labelled `opportunity` / `scholarship`.
 *     News-tagged items are never sent (they'd fail the threshold anyway).
 *   - Per-tick cap (DEFAULT_MAX_VERIFICATIONS = 30).
 *   - Per-item caching via `classification_audits/{itemId}` Firestore doc
 *     so we never re-verify the same item.
 *   - DeepSeek chat is ~$0.27/M in, $1.10/M out → ~$0.0003/verification.
 *     30 verifications × 4 ticks/hour × 24h = ~$0.86/day worst case.
 *
 * Logging:
 *   Every verification (kept or demoted) lands in `classification_audits`
 *   so the team can spot-check the model's calls.
 */

import type { Firestore } from "firebase-admin/firestore";

export type OriginalSocialTopic = "scholarship" | "opportunity";
export type VerifiedLabel = "real_opportunity" | "news_about_opportunity" | "news";

export interface VerifyOpportunityInput {
  itemId: string;
  title: string;
  summary?: string;
  /** Original topic assigned by the keyword classifier. */
  originalTopic: OriginalSocialTopic;
}

export interface VerifyOpportunityResult {
  /** Topic to use after verification. May equal originalTopic. */
  finalTopic: "scholarship" | "opportunity" | "news";
  verifiedLabel: VerifiedLabel;
  confidence: number;
  reason: string;
  /** True when the verifier downgraded the topic. */
  demoted: boolean;
  /** True when the result came from cache (no DeepSeek call). */
  cached: boolean;
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_BASE =
  process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

const AUDIT_COLLECTION = "classification_audits";
const MIN_CONFIDENCE_TO_DEMOTE = 0.7;
const REQUEST_TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT =
  `You are a careful classifier for a Haitian education news feed. ` +
  `Given an article title and summary, decide whether it is a callable opportunity ` +
  `for the reader (apply, register, submit, deadline) or just news ABOUT something. ` +
  `Return STRICT JSON: {"label": "real_opportunity" | "news_about_opportunity" | "news", ` +
  `"confidence": 0..1, "reason": "<one short sentence in English>"}. ` +
  `Definitions: ` +
  `"real_opportunity" = the reader can DO something now (apply for a scholarship, ` +
  `register for a contest, submit a CV, attend an info session before a deadline). ` +
  `"news_about_opportunity" = the article reports on an opportunity but the reader ` +
  `cannot act (it already happened, is restricted to a closed group, lacks a deadline). ` +
  `"news" = general news with no opportunity component (politics, accidents, sports, ` +
  `agreements between governments, market reports). ` +
  `Be strict: if the article is about an "accord", "réunion", "déclaration", or ` +
  `"signature" between governments or institutions, that is "news", not "real_opportunity".`;

interface DeepSeekClassification {
  label: VerifiedLabel;
  confidence: number;
  reason: string;
}

/**
 * Verify (and possibly demote) an opportunity-tagged item. Always resolves —
 * on any error it returns the original topic with `cached=false, demoted=false`
 * so the caller's flow continues unchanged.
 *
 * @param input  The item to verify.
 * @param db     Firestore handle for cache + audit log.
 */
export async function verifyOpportunityClassification(
  input: VerifyOpportunityInput,
  db: Firestore,
): Promise<VerifyOpportunityResult> {
  // Cache check first.
  try {
    const cached = await db.collection(AUDIT_COLLECTION).doc(input.itemId).get();
    if (cached.exists) {
      const data = cached.data() as Partial<DeepSeekClassification> & {
        finalTopic?: VerifyOpportunityResult["finalTopic"];
        demoted?: boolean;
      };
      if (data.label && data.finalTopic) {
        return {
          finalTopic: data.finalTopic,
          verifiedLabel: data.label,
          confidence: data.confidence ?? 1,
          reason: data.reason ?? "(cached)",
          demoted: data.demoted ?? false,
          cached: true,
        };
      }
    }
  } catch (err) {
    console.warn(
      `[verifyOpportunity] cache read failed for ${input.itemId}:`,
      err instanceof Error ? err.message : err,
    );
  }

  // No DeepSeek key → no-op (caller behavior is unchanged).
  if (!DEEPSEEK_API_KEY) {
    return passthrough(input);
  }

  let classification: DeepSeekClassification;
  try {
    classification = await callDeepSeek(input);
  } catch (err) {
    console.warn(
      `[verifyOpportunity] DeepSeek failed for ${input.itemId}:`,
      err instanceof Error ? err.message : err,
    );
    return passthrough(input);
  }

  const result = applyClassification(input, classification);

  // Best-effort audit write — never blocks the caller.
  void db
    .collection(AUDIT_COLLECTION)
    .doc(input.itemId)
    .set(
      {
        itemId: input.itemId,
        title: input.title.slice(0, 200),
        originalTopic: input.originalTopic,
        finalTopic: result.finalTopic,
        label: result.verifiedLabel,
        confidence: result.confidence,
        reason: result.reason,
        demoted: result.demoted,
        verifiedAt: new Date(),
        model: DEEPSEEK_MODEL,
      },
      { merge: true },
    )
    .catch((err: unknown) =>
      console.warn(
        `[verifyOpportunity] audit write failed for ${input.itemId}:`,
        err instanceof Error ? err.message : err,
      ),
    );

  return result;
}

function passthrough(input: VerifyOpportunityInput): VerifyOpportunityResult {
  return {
    finalTopic: input.originalTopic,
    verifiedLabel: "real_opportunity",
    confidence: 0,
    reason: "(verifier disabled or unavailable)",
    demoted: false,
    cached: false,
  };
}

function applyClassification(
  input: VerifyOpportunityInput,
  c: DeepSeekClassification,
): VerifyOpportunityResult {
  // Below the confidence floor → trust the original tag, log for review.
  if (c.confidence < MIN_CONFIDENCE_TO_DEMOTE) {
    return {
      finalTopic: input.originalTopic,
      verifiedLabel: c.label,
      confidence: c.confidence,
      reason: c.reason,
      demoted: false,
      cached: false,
    };
  }

  if (c.label === "real_opportunity") {
    return {
      finalTopic: input.originalTopic,
      verifiedLabel: c.label,
      confidence: c.confidence,
      reason: c.reason,
      demoted: false,
      cached: false,
    };
  }

  // Both "news_about_opportunity" and "news" demote to news.
  return {
    finalTopic: "news",
    verifiedLabel: c.label,
    confidence: c.confidence,
    reason: c.reason,
    demoted: true,
    cached: false,
  };
}

async function callDeepSeek(
  input: VerifyOpportunityInput,
): Promise<DeepSeekClassification> {
  const userPrompt = JSON.stringify({
    title: input.title,
    summary: input.summary?.slice(0, 1200) ?? "",
    originalTopic: input.originalTopic,
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.0,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
      signal: ac.signal,
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${resp.status}: ${body.slice(0, 200)}`);
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty content");

    const parsed = JSON.parse(content) as Partial<DeepSeekClassification>;
    if (
      !parsed.label ||
      !["real_opportunity", "news_about_opportunity", "news"].includes(parsed.label)
    ) {
      throw new Error(`invalid label: ${parsed.label}`);
    }
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
    return {
      label: parsed.label as VerifiedLabel,
      confidence: Math.max(0, Math.min(1, confidence)),
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 280) : "",
    };
  } finally {
    clearTimeout(timer);
  }
}
