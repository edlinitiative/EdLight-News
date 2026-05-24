/**
 * generateStoryboard — turns a chosen format + source items into a
 * structured ReelScene[] plus caption + hashtags.
 *
 * Single LLM call per Reel, returning a JSON object validated by zod. Each
 * scene is one short spoken line, mapped to one visual treatment, so the
 * resulting voiceover is naturally chopped into mobile-paced beats — NOT
 * a paragraph being read aloud.
 *
 * Per-format scene blueprints encode the editorial structure described in
 * docs/IG_COPILOT.md and the user's product spec:
 *
 *   opportunity_alert         hook → who → what → deadline → CTA
 *   haiti_explainer           what → why → what to watch
 *   weekly_opportunity_roundup intro → item × N → CTA
 */

import { z } from "zod";
import { callLLM, type LLMOptions } from "@edlight-news/generator";
import {
  FORMAT_DURATION,
  REEL_HARD_DURATION_CAP_SEC,
  type ReelFormat,
  type ReelLanguageV2,
  type ReelScene,
  type ReelSceneVisualType,
} from "./types.js";

// ── Source shape ───────────────────────────────────────────────────────────

export interface StoryboardSourceItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  sourceName?: string;
  /** Optional structured fields, e.g. deadline, amount, country. */
  structured?: Record<string, string | number | boolean | null | undefined>;
}

export interface GenerateStoryboardInput {
  format: ReelFormat;
  language: ReelLanguageV2;
  /** Primary item (used by alert + explainer). */
  primary: StoryboardSourceItem;
  /**
   * Roundup items (used only by `weekly_opportunity_roundup`). When provided
   * for the roundup format, 3–5 items are required.
   */
  roundup?: StoryboardSourceItem[];
  llm?: LLMOptions;
}

export interface GenerateStoryboardResult {
  title: string;
  storyboard: ReelScene[];
  caption: string;
  hashtags: string[];
  /** Concatenated voiceover used by TTS. */
  voiceover: string;
  /** Estimated speaking duration (seconds) for the concatenated voiceover. */
  estimatedDurationSec: number;
}

// ── Schema ────────────────────────────────────────────────────────────────

const visualTypeSchema = z.enum([
  "animated_headline",
  "image_card",
  "deadline_card",
  "checklist",
  "map",
  "logo_card",
  "quote_card",
  "brand_close",
  "b_roll",
  "roundup_item",
]);

const sceneSchema = z.object({
  voiceover: z.string().min(2).max(160),
  onScreenText: z.string().min(1).max(80),
  visualType: visualTypeSchema,
  assetHints: z.array(z.string().min(2).max(60)).max(5).optional(),
  targetDurationSec: z.number().positive().max(REEL_HARD_DURATION_CAP_SEC),
});

const llmStoryboardSchema = z.object({
  title: z.string().min(3).max(120),
  scenes: z.array(sceneSchema).min(3).max(8),
  caption: z.string().min(10).max(900),
  hashtags: z.array(z.string().min(2).max(40)).min(3).max(10),
});

// ── Per-format scene blueprints ───────────────────────────────────────────

/**
 * Returns a per-format prompt fragment describing the required scene shape.
 * Kept here (not in a separate file) so the prompt and the schema live
 * together — they must evolve in lockstep.
 */
function blueprintFor(format: ReelFormat, language: ReelLanguageV2): string {
  const langName =
    language === "fr" ? "French" :
    language === "ht" ? "Haitian Creole (Kreyòl)" : "English";

  const dur = FORMAT_DURATION[format];

  const common = `
LANGUAGE: ${langName}. Every spoken line and on-screen text MUST be in ${langName}.
DURATION: Aim for ~${dur.target}s total (min ${dur.min}s, max ${dur.max}s, HARD CAP ${REEL_HARD_DURATION_CAP_SEC}s).
SCENE VOICEOVER RULES:
  • One short spoken sentence per scene. Ideally 5–12 words.
  • Spoken, not written. Sandra speaks like a person, not a press release.
  • BAD:  "The university has announced a comprehensive international scholarship program designed to provide significant financial assistance…"
  • GOOD: "A new scholarship just opened." / "It supports international students." / "And the deadline is coming soon."
  • NEVER read the article word-for-word. NEVER invent facts.
ON-SCREEN TEXT RULES:
  • ≤ 6 words, ≤ 60 chars per scene. Mobile-safe area.
  • Title-case keywords or a short phrase the eye can grab in 1 second.`;

  switch (format) {
    case "opportunity_alert":
      return `${common}
FORMAT: opportunity_alert (12–22s)
REQUIRED SCENES (in order):
  1. HOOK             visualType: "animated_headline"  — grab attention, 1 sentence.
  2. WHO IT IS FOR    visualType: "checklist"          — who can apply.
  3. WHAT IT OFFERS   visualType: "image_card"         — funding / scope.
  4. DEADLINE         visualType: "deadline_card"      — must include the date or "soon".
  5. CTA              visualType: "brand_close"        — "Follow @edlightnews for more" or equivalent.
Total: exactly 5 scenes.`;

    case "haiti_explainer":
      return `${common}
FORMAT: haiti_explainer (20–35s)
REQUIRED SCENES (in order):
  1. WHAT HAPPENED       visualType: "animated_headline"  — the news, factually.
  2. KEY DETAIL          visualType: "image_card"         — one concrete fact (number, place, person).
  3. WHY IT MATTERS      visualType: "b_roll"             — impact on young Haitians.
  4. WHAT TO WATCH NEXT  visualType: "checklist"          — 1–2 things to track.
  5. CTA                 visualType: "brand_close"        — sign-off in Sandra's voice.
Total: exactly 5 scenes.`;

    case "weekly_opportunity_roundup":
      return `${common}
FORMAT: weekly_opportunity_roundup (25–45s)
REQUIRED SCENES (in order):
  1. INTRO       visualType: "animated_headline"  — "Here are N opportunities closing soon."
  2..N+1. ITEM   visualType: "roundup_item"       — one per opportunity (3–5 total). Each: name + deadline-or-amount in ≤ 12 spoken words.
  N+2. CTA       visualType: "brand_close"        — save / follow / check link in bio.
Each item must reference the exact opportunity from the provided list (do not invent extras).`;
  }
}

function describePrimary(item: StoryboardSourceItem): string {
  const lines = [
    `Title: ${item.title}`,
    item.sourceName ? `Source: ${item.sourceName}` : null,
    `Summary: ${item.summary}`,
  ].filter(Boolean);
  if (item.structured && Object.keys(item.structured).length > 0) {
    lines.push(`Structured: ${JSON.stringify(item.structured)}`);
  }
  return lines.join("\n");
}

function describeRoundup(items: StoryboardSourceItem[]): string {
  return items
    .map(
      (it, i) =>
        `${i + 1}. ${it.title}${it.sourceName ? ` — ${it.sourceName}` : ""}\n     ${it.summary}${
          it.structured && Object.keys(it.structured).length > 0
            ? `\n     ${JSON.stringify(it.structured)}`
            : ""
        }`,
    )
    .join("\n");
}

function buildPrompt(input: GenerateStoryboardInput): string {
  const { format, primary, roundup, language } = input;

  const sourceBlock =
    format === "weekly_opportunity_roundup"
      ? `OPPORTUNITIES (use all of them, in this order):\n${describeRoundup(
          roundup && roundup.length > 0 ? roundup : [primary],
        )}`
      : `SOURCE ITEM:\n${describePrimary(primary)}`;

  return `You are writing an EdLight News short-form Reel narrated by Sandra.
EdLight News is a youth-focused, Haitian + international, news + opportunity publisher.

${blueprintFor(format, language)}

${sourceBlock}

OUTPUT — return ONLY a JSON object, no markdown fences, with EXACTLY this shape:
{
  "title": "short editorial title for the Reel (≤ 10 words, in ${language})",
  "scenes": [
    {
      "voiceover": "short spoken line",
      "onScreenText": "≤ 6 words overlay",
      "visualType": "one of the visualType values from the blueprint",
      "assetHints": ["2-4 keyword phrases for visual search"],
      "targetDurationSec": 3.5
    }
  ],
  "caption": "Instagram caption (1–3 short sentences) in ${language}",
  "hashtags": ["3–8 hashtags WITHOUT leading #"]
}

HARD RULES:
- Use the EXACT scene order required by the format.
- Sum of targetDurationSec must respect the format duration window.
- Never include fields not specified above.
- Never invent facts not present in the source(s).`;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Average Sandra speaking rate at the 1.1× Reels cadence ≈ 2.7 words/sec.
 * Used to sanity-check the LLM's targetDurationSec and clamp the storyboard
 * to a renderer-friendly value when it under- or over-shoots.
 */
const WORDS_PER_SEC = 2.7;

function estimateSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, words / WORDS_PER_SEC);
}

export async function generateStoryboard(
  input: GenerateStoryboardInput,
): Promise<GenerateStoryboardResult> {
  if (
    input.format === "weekly_opportunity_roundup" &&
    (!input.roundup || input.roundup.length < 2)
  ) {
    throw new Error(
      "generateStoryboard: weekly_opportunity_roundup requires roundup.length >= 2",
    );
  }

  const prompt = buildPrompt(input);
  const raw = await callLLM(prompt, {
    temperature: 0.5,
    maxOutputTokens: 1600,
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
    throw new Error(
      `generateStoryboard: LLM returned non-JSON: ${(err as Error).message}\n--- raw ---\n${raw.slice(0, 400)}`,
    );
  }
  const parsedResult = llmStoryboardSchema.safeParse(parsed);
  if (!parsedResult.success) {
    throw new Error(
      `generateStoryboard: schema validation failed: ${parsedResult.error.message}`,
    );
  }
  const data = parsedResult.data;

  // Re-compute scene timing from spoken-word estimate when the LLM's target
  // is wildly off (>40% delta). This is what actually drives the TTS.
  const scenes: ReelScene[] = [];
  let cursor = 0;
  for (let i = 0; i < data.scenes.length; i++) {
    const s = data.scenes[i]!;
    const estimated = estimateSec(s.voiceover);
    const target =
      Math.abs(s.targetDurationSec - estimated) / estimated > 0.4
        ? estimated
        : s.targetDurationSec;
    const dur = Math.min(target, REEL_HARD_DURATION_CAP_SEC);
    const startSec = Number(cursor.toFixed(2));
    const endSec = Number((cursor + dur).toFixed(2));
    cursor = endSec;
    scenes.push({
      id: `s${i + 1}`,
      startSec,
      endSec,
      voiceover: s.voiceover.trim(),
      onScreenText: s.onScreenText.trim(),
      visualType: s.visualType as ReelSceneVisualType,
      assetHints: s.assetHints,
    });
  }

  // Clamp final duration to the hard cap by trimming trailing scenes.
  while (
    scenes.length > 3 &&
    scenes[scenes.length - 1]!.endSec > REEL_HARD_DURATION_CAP_SEC
  ) {
    scenes.pop();
  }

  const voiceover = scenes.map((s) => s.voiceover).join(" ");
  const estimatedDurationSec =
    scenes.length > 0 ? scenes[scenes.length - 1]!.endSec : 0;

  return {
    title: data.title,
    storyboard: scenes,
    caption: data.caption,
    hashtags: data.hashtags.map((h) => h.replace(/^#+/, "")),
    voiceover,
    estimatedDurationSec,
  };
}
