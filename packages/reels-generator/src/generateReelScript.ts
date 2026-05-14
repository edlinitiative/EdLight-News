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

// ── Schemas ────────────────────────────────────────────────────────────────

/**
 * One canonical script shape that covers all 4 templates. Fields are optional
 * because each template uses a different subset; the orchestrator validates
 * that the template-required fields are present after parsing.
 */
const reelScriptSchema = z.object({
  /** The voiceover Sandra reads — 35–80 words, hits 15–28s at her cadence. */
  voiceover: z.string().min(40).max(600),
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
  /** IG caption — 1–2 short sentences + 3–6 hashtags. */
  caption: z.string().min(20).max(800),
  /** Hashtags as a flat array, no leading #. We add # at render. */
  hashtags: z.array(z.string().min(2).max(40)).min(3).max(8),
  /** Source attribution chip displayed in the corner. */
  sourceLabel: z.string().max(60).optional(),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;

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
  /** Optional override for the LLM call (provider, temperature, etc.). */
  llm?: LLMOptions;
}

// ── Prompt ─────────────────────────────────────────────────────────────────

function buildPrompt(input: GenerateReelScriptInput): string {
  const { topic, template, item, contextItems = [] } = input;

  const templateInstructions: Record<ReelTemplate, string> = {
    BigStatistic:
      "Pick or compute ONE stat from the source. Fill `hero` (the number, ≤ 40 chars), `hook` (≤ 8 words above it), `context` (≤ 90 chars below).",
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

  return `You are writing a 15–28 second Reel script for EdLight News, voiced by Sandra.

SANDRA'S VOICE:
- Warm, factual, intelligent. Never sensational.
- Haitian-French register. Code-switch to Kreyòl ONLY for one short phrase max.
- Never invent statistics. If the source doesn't have it, omit it.
- End the voiceover on a forward-looking note ("on suit ça", "à demain", "rete branche").
- 35–80 words for the voiceover. Aim for ~22 seconds at normal cadence.

TOPIC: ${topic}
${topicGuidance[topic]}

TEMPLATE: ${template}
${templateInstructions[template]}

SOURCE ITEM:
Title: ${item.title}
${item.sourceName ? `Source: ${item.sourceName}\n` : ""}Summary: ${item.summary}${structuredBlock}${contextBlock}

OUTPUT REQUIREMENTS:
- Return ONLY a JSON object, no markdown fences.
- "voiceover": Sandra's spoken script (35–80 words, French, plain text — no SSML, no stage directions).
- Template-specific fields per the TEMPLATE section above.
- "caption": IG caption, 1–2 short sentences + 3–6 hashtags inline. French.
- "hashtags": array of 3–8 hashtag strings (no leading #).
- "sourceLabel": short attribution chip (e.g. "Le Nouvelliste · 15 mars").

Do NOT include any field not specified above. Do NOT wrap in markdown.`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a script for a single reel. The returned object is fully validated
 * and contains the fields needed to render `template`. Callers should still
 * verify template-specific required fields with `assertScriptForTemplate`.
 */
export async function generateReelScript(
  input: GenerateReelScriptInput,
): Promise<ReelScript> {
  const prompt = buildPrompt(input);
  const raw = await callLLM(prompt, {
    temperature: 0.4,
    maxOutputTokens: 1200,
    jsonMode: true,
    ...input.llm,
  });

  // The LLM occasionally wraps in ```json fences despite jsonMode — strip defensively.
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
    throw new Error(
      `generateReelScript: LLM returned non-JSON output: ${(err as Error).message}\n--- raw ---\n${raw.slice(0, 400)}`,
    );
  }

  const result = reelScriptSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `generateReelScript: schema validation failed: ${result.error.message}`,
    );
  }

  assertScriptForTemplate(result.data, input.template);
  return result.data;
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
    throw new Error(
      `generateReelScript: template "${template}" requires fields: ${missing.join(", ")}`,
    );
  }
}
