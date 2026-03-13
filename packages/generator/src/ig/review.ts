/**
 * IG Slide Reviewer — Second-pass LLM quality gate.
 *
 * After the formatter produces slides + caption, the reviewer:
 *  1. Detects and fixes any English text → translates to French
 *  2. Ensures narrative continuity across slides (sequential story arc)
 *  3. Enforces emoji limits (≤2 for histoire, ≤5 for others)
 *  4. Verifies first slide captures the full headline (not truncated)
 *  5. Ensures caption echoes the slide narrative
 *
 * The reviewer FIXES issues rather than rejecting — it returns corrected
 * slides/caption. The existing rule-based audit then validates the fix.
 */

import { callLLM, type LLMOptions } from "../client.js";
import type { IGFormattedPayload, IGSlide, IGPostType } from "@edlight-news/types";

// ── Configuration ──────────────────────────────────────────────────────────

const MAX_EMOJI_HISTOIRE = 2;
const MAX_EMOJI_DEFAULT = 5;
const REVIEWER_TEMPERATURE = 0.2; // Low temp for precise corrections

/** Use a dedicated reviewer provider if configured, else default. */
function getReviewerOptions(): LLMOptions {
  const provider = process.env.LLM_REVIEWER_PROVIDER;
  const model = process.env.LLM_REVIEWER_MODEL;
  return {
    ...(provider ? { provider: provider as LLMOptions["provider"] } : {}),
    ...(model ? { model } : {}),
    temperature: REVIEWER_TEMPERATURE,
    maxOutputTokens: 4096,
    jsonMode: true,
  };
}

// ── Emoji counter ──────────────────────────────────────────────────────────

const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

export function countEmojis(text: string): number {
  return (text.match(EMOJI_REGEX) || []).length;
}

function countPayloadEmojis(payload: IGFormattedPayload): number {
  let total = 0;
  for (const slide of payload.slides) {
    total += countEmojis(slide.heading);
    for (const b of slide.bullets) total += countEmojis(b);
  }
  return total;
}

// ── Quick pre-checks (avoid LLM call when unnecessary) ─────────────────────

export function needsReview(payload: IGFormattedPayload, igType: IGPostType): boolean {
  const maxEmoji = igType === "histoire" ? MAX_EMOJI_HISTOIRE : MAX_EMOJI_DEFAULT;

  // Check emoji excess
  if (countPayloadEmojis(payload) > maxEmoji) return true;

  // Check for English in slides
  const allText = payload.slides
    .flatMap((s) => [s.heading, ...s.bullets])
    .join(" ");
  if (hasEnglishMarkers(allText)) return true;

  // Check narrative coherence: if slides 2+ repeat slide 1's heading
  if (payload.slides.length >= 2) {
    const h1 = payload.slides[0]!.heading.toLowerCase();
    for (let i = 1; i < payload.slides.length; i++) {
      const hi = payload.slides[i]!.heading.toLowerCase();
      if (hi === h1 || similarity(h1, hi) > 0.8) return true;
    }
  }

  return false;
}

/** Lightweight English marker detection (shared with helpers.ts logic). */
const EN_WORDS = [
  /\bmust be\b/i, /\bshould be\b/i, /\bapplicants?\b/i,
  /\brequired\b/i, /\bsubmit\b/i, /\byou must\b/i,
  /\beligible\b/i, /\bcitizens? of\b/i, /\bapply online\b/i,
  /\bscholarship\b/i, /\bfunding\b/i, /\bfellowship\b/i,
  /\bthe applicant\b/i, /\bopen to\b/i, /\bmust have\b/i,
  /\bdeveloping countr/i, /\ball nationalities\b/i,
  /\bthe following\b/i, /\bin order to\b/i, /\bplease note\b/i,
  /\bfor more information\b/i, /\bclick here\b/i,
];

function hasEnglishMarkers(text: string): boolean {
  let hits = 0;
  for (const re of EN_WORDS) {
    if (re.test(text)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/** Jaccard similarity between two strings (word-level). */
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ── Reviewer prompt ────────────────────────────────────────────────────────

function buildReviewerPrompt(
  payload: IGFormattedPayload,
  igType: IGPostType,
): string {
  const maxEmoji = igType === "histoire" ? MAX_EMOJI_HISTOIRE : MAX_EMOJI_DEFAULT;

  const slidesJSON = payload.slides.map((s, i) => ({
    index: i,
    heading: s.heading,
    bullets: s.bullets,
    layout: s.layout ?? (i === 0 ? "headline" : "explanation"),
  }));

  return `Tu es un éditeur professionnel pour EdLight News (Instagram, public haïtien francophone).
Tu reçois les slides et la légende d'un carrousel Instagram à vérifier et corriger.

RÈGLES STRICTES — applique TOUTES ces corrections:

1. LANGUE: Tout le contenu DOIT être en français. Si tu trouves de l'anglais (même un seul mot technique comme "scholarship", "eligible", "applicants"), traduis-le en français. NE LAISSE AUCUN mot anglais.

2. COHÉRENCE NARRATIVE:
   - La slide 1 doit capturer L'ESSENCE COMPLÈTE du sujet (pas un titre tronqué).
   - Les slides 2, 3, 4... doivent CONTINUER l'histoire séquentiellement.
   - En lisant slides 1→2→3→...→N, le lecteur doit comprendre une histoire fluide et complète.
   - La légende doit refléter le même arc narratif.
   - Aucune slide ne doit répéter le contenu d'une autre.

3. EMOJIS: Maximum ${maxEmoji} emojis au total dans TOUTES les slides combinées.${igType === "histoire" ? " L'histoire demande de la gravité — très peu d'emojis." : ""}

4. PREMIER SLIDE: Le heading de la slide 0 doit être un titre complet et percutant qui résume le sujet. Jamais un titre coupé en plein milieu d'une phrase.

5. NE CHANGE PAS la structure (nombre de slides, layout, backgroundImage). Corrige UNIQUEMENT heading, bullets, et caption.

SLIDES ACTUELLES:
${JSON.stringify(slidesJSON, null, 2)}

LÉGENDE ACTUELLE:
${payload.caption}

TYPE DE POST: ${igType}

RÉPONDS EN JSON VALIDE:
{
  "corrections_made": ["description de chaque correction"],
  "slides": [
    { "index": 0, "heading": "titre corrigé", "bullets": ["bullet corrigé 1", "bullet 2"] },
    ...
  ],
  "caption": "légende corrigée complète"
}

Si AUCUNE correction n'est nécessaire, retourne:
{ "corrections_made": [], "slides": [], "caption": "" }`;
}

// ── Review result type ─────────────────────────────────────────────────────

export interface ReviewResult {
  /** Whether any corrections were applied */
  corrected: boolean;
  /** List of corrections made (for logging) */
  corrections: string[];
  /** The corrected payload (or original if no corrections needed) */
  payload: IGFormattedPayload;
}

// ── Main reviewer function ─────────────────────────────────────────────────

/**
 * Review and fix formatted IG slides using a second LLM pass.
 *
 * Workflow:
 *  1. Quick pre-check: skip LLM if no issues detected
 *  2. Send to reviewer LLM with correction instructions
 *  3. Parse response and apply corrections to the original payload
 *  4. Return corrected payload
 */
export async function reviewSlides(
  payload: IGFormattedPayload,
  igType: IGPostType,
): Promise<ReviewResult> {
  // Quick check — skip LLM call if everything looks clean
  if (!needsReview(payload, igType)) {
    return { corrected: false, corrections: [], payload };
  }

  console.log(`[ig-review] Reviewing ${igType} post (${payload.slides.length} slides)...`);

  try {
    const prompt = buildReviewerPrompt(payload, igType);
    const raw = await callLLM(prompt, getReviewerOptions());

    // Parse the LLM response
    const parsed = JSON.parse(raw) as {
      corrections_made: string[];
      slides: { index: number; heading: string; bullets: string[] }[];
      caption: string;
    };

    // No corrections needed
    if (
      !parsed.corrections_made?.length &&
      !parsed.slides?.length &&
      !parsed.caption
    ) {
      return { corrected: false, corrections: [], payload };
    }

    // Apply corrections to a copy of the payload
    const corrected: IGFormattedPayload = {
      ...payload,
      slides: payload.slides.map((s) => ({ ...s, bullets: [...s.bullets] })),
      caption: payload.caption,
    };

    if (parsed.slides?.length) {
      for (const fix of parsed.slides) {
        const slide = corrected.slides[fix.index];
        if (!slide) continue;
        if (fix.heading) slide.heading = fix.heading;
        if (fix.bullets?.length) slide.bullets = fix.bullets;
      }
    }

    if (parsed.caption) {
      corrected.caption = parsed.caption;
    }

    const corrections = parsed.corrections_made ?? [];
    console.log(`[ig-review] Applied ${corrections.length} correction(s):`, corrections);

    return { corrected: true, corrections, payload: corrected };
  } catch (err) {
    // Reviewer failure is non-fatal — return original payload
    console.warn(
      `[ig-review] Review failed, using original payload:`,
      err instanceof Error ? err.message : err,
    );
    return { corrected: false, corrections: [], payload };
  }
}
