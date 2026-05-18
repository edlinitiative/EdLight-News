/**
 * generateReelScript — produces a Sandra-voiced reel script from a topic + source items.
 *
 * Output shape is constrained by the template the caller picked, so the LLM
 * fills exactly the fields the chosen template renders. We use jsonMode and
 * validate with zod for safety.
 *
 * Sandra voice rules (from `@edlight-news/sandra-voice` SANDRA_VOICE_PROFILE):
 *  - Warm, factual, never sensational
 *  - Haitian-French register, code-switch to Kreyòl only for emphasis (≤ 1 phrase)
 *  - Never invent stats; if the source doesn't have it, omit it
 *  - End on a forward-looking note ("on suit ça", "à demain")
 */

import { z } from "zod";
import { callLLM, type LLMOptions } from "@edlight-news/generator";
import type { ReelTopic, ReelTemplate } from "./types.js";
import type { HeroNumber } from "./extractHeroNumber.js";

// ── Schemas ────────────────────────────────────────────────────────────────

/**
 * One canonical script shape that covers all 4 templates. Fields are optional
 * because each template uses a different subset; the orchestrator validates
 * that the template-required fields are present after parsing.
 */
/** Min/max word counts for Sandra's voiceover. */
export const VOICEOVER_MIN_WORDS = 35;
export const VOICEOVER_MAX_WORDS = 72;
/** Min/max scenes the LLM should structure (when it returns `scenes`). */
export const MIN_STRUCTURED_SCENES = 3;

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const reelScriptSchema = z.object({
  /**
   * Sandra's voiceover — 38–70 words, hits 12–16 s at 1.1× speed cadence.
   * The word-count floor is enforced because shorter scripts collapse the
   * body composition to < 8 s, which truncates the CTA scene and trips
   * the post-mux duration gate. See `composeReel.assertRenderQuality`.
   */
  voiceover: z
    .string()
    .min(20)
    .max(500)
    .refine(
      (s) => {
        const w = countWords(s);
        return w >= VOICEOVER_MIN_WORDS && w <= VOICEOVER_MAX_WORDS;
      },
      (s) => ({
        message: `voiceover must be ${VOICEOVER_MIN_WORDS}–${VOICEOVER_MAX_WORDS} words (got ${countWords(s)})`,
      }),
    ),
  /**
   * Optional structured scene chunks (v1.3). When present, each entry maps to
   * one scene in the template director. If missing, buildReel falls back to
   * proportional allocation. The LLM may omit this field.
   */
  scenes: z.array(z.object({
    sceneId: z.string(),
    text: z.string(),
    targetDurationSec: z.number().positive(),
  })).optional(),
  /** Hook for BigStatistic; small text above the hero number. */
  hook: z.string().max(60).optional(),
  /** The hero string for BigStatistic (the number). */
  hero: z.string().max(40).optional(),
  /** Context line under hero. */
  context: z.string().max(120).optional(),
  /** Quote text for PullQuote (no enclosing quotes — we add typography). */
  quote: z.string().max(180).optional(),
  /** Quote attribution. */
  attribution: z.string().max(80).optional(),
  /** Headline for HeadlinePhoto. */
  headline: z.string().max(90).optional(),
  /** Framing line for NumberedPoints (e.g. "3 choses à savoir"). */
  framing: z.string().max(60).optional(),
  /** 3–5 bullet points for NumberedPoints. */
  points: z.array(z.string().max(110)).min(2).max(5).optional(),
  /**
   * Information-dense supporting facts that templates can render as cards
   * (HeadlinePhoto ContextScene, NumberedPoints sub-scenes). All optional;
   * each ≤ 48 chars so it fits a 1080-wide hero card without wrapping.
   * The LLM is instructed to only fill a field when the source explicitly
   * states the value — never invent.
   */
  keyFacts: z
    .object({
      amount: z.string().max(48).optional(),
      deadline: z.string().max(48).optional(),
      eligibility: z.string().max(48).optional(),
      action: z.string().max(48).optional(),
    })
    .optional(),
  /** IG caption — 1–2 short sentences + 3–6 hashtags. */
  caption: z.string().min(20).max(800),
  /** Hashtags as a flat array, no leading #. We add # at render. */
  hashtags: z.array(z.string().min(2).max(40)).min(3).max(8),
  /** Source attribution chip displayed in the corner. */
  sourceLabel: z.string().max(60).optional(),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;

/**
 * Thrown when the LLM returns a schema-valid script that is missing the
 * fields a specific template requires (e.g. PullQuote without `quote`).
 *
 * This is recoverable at the orchestrator level — `buildReel` catches it and
 * retries once with the next template in the topic's preference list. We use
 * a dedicated class so the retry logic only fires on this exact failure mode
 * and never swallows real LLM/JSON errors.
 */
export class TemplateRequirementError extends Error {
  readonly template: ReelTemplate;
  readonly missingFields: string[];
  constructor(template: ReelTemplate, missingFields: string[]) {
    super(
      `generateReelScript: template "${template}" requires fields: ${missingFields.join(", ")}`,
    );
    this.name = "TemplateRequirementError";
    this.template = template;
    this.missingFields = missingFields;
  }
}

// ── Input ──────────────────────────────────────────────────────────────────

export interface ReelSourceItem {
  /** Stable identifier from the originating Firestore doc. */
  id: string;
  title: string;
  /** Short summary (≤ 600 chars). */
  summary: string;
  /** Optional URL — not displayed but used for attribution. */
  url?: string;
  /** Optional source name (e.g. "Le Nouvelliste"). */
  sourceName?: string;
  /** Topic-specific structured fields (e.g. exchange rate, deadline). */
  structured?: Record<string, string | number | boolean>;
}

export interface GenerateReelScriptInput {
  topic: ReelTopic;
  template: ReelTemplate;
  /** The chosen source item that drives the reel content. */
  item: ReelSourceItem;
  /** Optional secondary items used as context (not the focus). */
  contextItems?: ReelSourceItem[];
  /**
   * Salient hero number pre-extracted by `extractHeroNumber`. When present
   * AND the template is `BigStatistic`, the prompt instructs the LLM to use
   * this exact value as the `hero` field instead of inventing one.
   */
  heroNumber?: HeroNumber;
  /** Optional override for the LLM call (provider, temperature, etc.). */
  llm?: LLMOptions;
}

// ── Prompt ─────────────────────────────────────────────────────────────────

function buildPrompt(input: GenerateReelScriptInput, opts?: { strict?: boolean }): string {
  const { topic, template, item, contextItems = [], heroNumber } = input;
  const strict = opts?.strict ?? false;

  const templateInstructions: Record<ReelTemplate, string> = {
    BigStatistic:
      heroNumber
        ? `Use this EXACT pre-selected hero value (do not invent a different number): hero = "${heroNumber.value}" (kind: ${heroNumber.kind}). Make it the first 1–2 spoken words after the hook in the voiceover. Fill \`hook\` (≤ 8 words above it) and \`context\` (≤ 90 chars below).`
        : "Pick or compute ONE stat from the source. Fill `hero` (the number, ≤ 40 chars), `hook` (≤ 8 words above it), `context` (≤ 90 chars below). Do NOT use a bare year (e.g. \"2026\") as the hero — pick the deadline, count, or amount instead.",
    PullQuote:
      "Extract or paraphrase ONE quote from the source. Fill `quote` (≤ 28 words, no quote marks) and `attribution` (person, role, year if known).",
    HeadlinePhoto:
      "Write ONE punchy headline (≤ 12 words). Fill `headline` and `sourceLabel`.",
    NumberedPoints:
      "Write 3 to 5 short bullet points (≤ 14 words each). Fill `framing` (e.g. \"3 choses à savoir\") and `points`.",
  };

  const topicGuidance: Record<ReelTopic, string> = {
    scholarship:
      "Talk about the scholarship: who can apply, deadline, amount. Be precise on dates and numbers.",
    opportunity:
      "Highlight the opportunity. Always mention deadline and how to apply.",
    taux:
      "State today's rate clearly. Don't sensationalize daily moves; give 1 quick context line.",
    news:
      "Report the news factually. No editorializing. Sandra reports, she doesn't take sides.",
    histoire:
      "Tell the historical fact with respect. Cite the year. End with one sentence on why it still matters.",
    fact:
      "Lead with the surprising fact. Keep it light but accurate.",
    education:
      "Practical, encouraging tone. Always end with one actionable suggestion.",
  };

  const contextBlock =
    contextItems.length > 0
      ? `\n\nCONTEXT ITEMS (background only — not the focus):\n${contextItems
          .map((c, i) => `${i + 1}. ${c.title} — ${c.summary}`)
          .join("\n")}`
      : "";

  const structuredBlock = item.structured
    ? `\n\nSTRUCTURED DATA:\n${JSON.stringify(item.structured, null, 2)}`
    : "";

  return `You are writing a 12–16 second Reel script for EdLight News, voiced by Sandra.

${strict ? "⚠ STRICT RETRY: the previous output failed validation. Follow EVERY rule below exactly.\n\n" : ""}🎯 THE SINGLE MOST IMPORTANT RULE — VOICEOVER LENGTH 🎯
The "voiceover" field MUST be 50–65 words. NOT a 1-sentence tagline. NOT a
2-sentence summary. It is a 13-SECOND spoken paragraph.

WORKED EXAMPLE (count the words — this is 56 words, ✅ acceptable):
"La Royal Society lance la première session des bourses Short Industry
Fellowships 2026, ouvertes aux chercheurs jusqu'au 15 mars. Le programme finance
des collaborations industrielles au Royaume-Uni, de six à vingt-quatre mois,
avec voyage et hébergement couverts. Les domaines visés : sciences naturelles,
ingénierie, technologies appliquées. Candidatures sur royalsociety.org. On suit ça."

WRONG EXAMPLE (this is 14 words — REJECTED):
"La Royal Society offre des bourses, dépôt jusqu'au 15 mars. À ne pas manquer."

Count your words before returning. If under 50, ADD another fact from the body
(length of program, funding components, host country, application URL, who
should apply). If over 65, trim filler.

SANDRA'S VOICE:
- Warm, factual, intelligent. Never sensational.
- Haitian-French register. Code-switch to Kreyòl ONLY for one short phrase max.
- End the voiceover on a forward-looking note ("on suit ça", "à demain", "rete branche").

STRICT FACT POLICY (zero tolerance):
- NEVER invent a fact. If the source does not state it, omit it.
- Do NOT add nationalities, locations, eligibility groups, or beneficiaries that
  are not explicitly named in the source. Example: if the source does not say
  "Haitian students", do NOT say "étudiants haïtiens" — say "candidats" instead.
- Numbers (amounts, deadlines, counts, years) must be copy-pasted verbatim from
  the source. Do not approximate, convert currencies, or round.
- If you cannot find a specific fact for a "keyFacts" slot, OMIT that slot —
  do not invent.

TOPIC: ${topic}
${topicGuidance[topic]}

TEMPLATE: ${template}
${templateInstructions[template]}

SOURCE ITEM:
Title: ${item.title}
${item.sourceName ? `Source: ${item.sourceName}\n` : ""}Body (your ONLY source of facts — read it fully and pull amount, deadline, eligibility, host, action from it):
${item.summary}${structuredBlock}${contextBlock}

REQUIRED STRUCTURED OUTPUT:
1. "voiceover": Sandra's spoken script (50–65 words, French/Kreyòl, plain text — no SSML, no stage directions). MUST be 50+ words. Count before returning.
2. "scenes": REQUIRED. An array of 3 or 4 scene objects (one per template scene).
   Each: { "sceneId": string, "text": string, "targetDurationSec": number > 0 }.
   Sum of targetDurationSec ≈ length of voiceover at 1.1× speed (typically 12–15s).
3. "keyFacts": REQUIRED. Object with up to 4 short fields, each ≤ 48 chars.
   Fill ONLY when the source explicitly states the value. Omit fields not in source.
   - "amount":      e.g. "Bourse complète", "15 000 USD/an"
   - "deadline":    e.g. "15 mars 2026", "Dépôt avant 30 avril"
   - "eligibility": e.g. "Étudiants en master", "Chercheurs UK"
   - "action":      e.g. "Postuler sur royalsociety.org"
4. Template-specific fields per the TEMPLATE section above.
5. "caption": IG caption, 1–2 short sentences + 3–6 hashtags inline. French.
6. "hashtags": array of 3–8 hashtag strings (no leading #).
7. "sourceLabel": short attribution chip (e.g. "Le Nouvelliste · 15 mars").

Return ONLY a JSON object. No markdown fences. No extra fields.`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a script for a single reel. The returned object is fully validated
 * and contains the fields needed to render `template`. Callers should still
 * verify template-specific required fields with `assertScriptForTemplate`.
 *
 * Retries up to 2 times on word-count, missing-scenes, or schema failures.
 * Each retry switches to the "strict" prompt variant that names the failure.
 * `TemplateRequirementError` is thrown immediately (no retry — the orchestrator
 * walks the template fallback list instead).
 */
export async function generateReelScript(
  input: GenerateReelScriptInput,
): Promise<ReelScript> {
  const MAX_ATTEMPTS = 3; // 1 normal + 2 strict retries
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const strict = attempt > 1;
    const prompt = buildPrompt(input, { strict });
    const raw = await callLLM(prompt, {
      // Lower the temperature on retry to reduce drift.
      temperature: strict ? 0.2 : 0.4,
      maxOutputTokens: 1200,
      jsonMode: true,
      ...input.llm,
    });

    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      lastErr = new Error(
        `generateReelScript: LLM returned non-JSON output: ${(err as Error).message}\n--- raw ---\n${raw.slice(0, 400)}`,
      );
      console.warn(
        `[generateReelScript] attempt ${attempt}/${MAX_ATTEMPTS} JSON parse failed — ${(err as Error).message}`,
      );
      continue;
    }

    const result = reelScriptSchema.safeParse(parsed);
    if (!result.success) {
      lastErr = new Error(
        `generateReelScript: schema validation failed: ${result.error.message}`,
      );
      console.warn(
        `[generateReelScript] attempt ${attempt}/${MAX_ATTEMPTS} schema failed — ${result.error.issues.map((i) => i.path.join(".") + ":" + i.message).join("; ")}`,
      );
      continue;
    }

    // Soft requirement (not enforced by zod because it would break callers
    // that legitimately pass a `scenes`-less script through the test fixtures):
    // when scenes are missing OR fewer than MIN_STRUCTURED_SCENES, retry.
    const scenes = result.data.scenes ?? [];
    if (scenes.length < MIN_STRUCTURED_SCENES) {
      lastErr = new Error(
        `generateReelScript: missing structured scenes (got ${scenes.length}, need ≥ ${MIN_STRUCTURED_SCENES})`,
      );
      console.warn(
        `[generateReelScript] attempt ${attempt}/${MAX_ATTEMPTS} scenes=${scenes.length} (< ${MIN_STRUCTURED_SCENES}) — retrying`,
      );
      // Only retry if attempts remain; on the final attempt, accept the
      // script (composer falls back to proportional allocation).
      if (attempt < MAX_ATTEMPTS) continue;
    }

    assertScriptForTemplate(result.data, input.template);
    if (attempt > 1) {
      console.log(
        `[generateReelScript] succeeded on attempt ${attempt}/${MAX_ATTEMPTS} (strict prompt).`,
      );
    }
    return result.data;
  }

  throw lastErr ?? new Error("generateReelScript: exhausted retries");
}

/**
 * Verify that the template-specific fields are present after schema parsing.
 * Throws with a helpful message identifying which field is missing.
 */
export function assertScriptForTemplate(
  script: ReelScript,
  template: ReelTemplate,
): void {
  const missing: string[] = [];
  switch (template) {
    case "BigStatistic":
      if (!script.hero) missing.push("hero");
      if (!script.hook) missing.push("hook");
      if (!script.context) missing.push("context");
      break;
    case "PullQuote":
      if (!script.quote) missing.push("quote");
      if (!script.attribution) missing.push("attribution");
      break;
    case "HeadlinePhoto":
      if (!script.headline) missing.push("headline");
      break;
    case "NumberedPoints":
      if (!script.framing) missing.push("framing");
      if (!script.points || script.points.length < 2) missing.push("points");
      break;
  }
  if (missing.length > 0) {
    throw new TemplateRequirementError(template, missing);
  }
}
