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
import type { IGFormattedPayload, IGSlide, IGPostType, Item } from "@edlight-news/types";
import { buildSourceLine, ensureFrenchOpportunityCopy, finalizeCaption, formatDeadline, hasCaptionQualityIssues } from "./formatters/helpers.js";

// ── Configuration ──────────────────────────────────────────────────────────

const MAX_EMOJI_HISTOIRE = 2;
const MAX_EMOJI_DEFAULT = 5;
const REVIEWER_TEMPERATURE = 0.2; // Low temp for precise corrections

// ── PRD §9.3: Tone / AI-filler detection ─────────────────────────────────────
// Patterns that indicate weak editorial language: filler preambles, hedged
// claims, or AI-sounding generic phrases. Their presence triggers a reviewer
// pass to rewrite them into direct, factual statements.
const AI_FILLER_RE: RegExp[] = [
  /\bil est important de noter\b/i,
  /\ben conclusion,?\s/i,
  /\bil convient de souligner\b/i,
  /\bcomme mentionné\b/i,
  /\bdans le cadre de\b/i,
  /\bforce est de constater\b/i,
  /\bil va sans dire\b/i,
  /\bcet article explore\b/i,
  /\bdans cet article\b/i,
  /\bnous allons voir\b/i,
  /\bil est à noter que\b/i,
  /\bà noter que\b/i,
  /\bsemble indiquer que\b/i,
  /\bpourrait potentiellement\b/i,
  /\bcomme nous l['\u2019]avons vu\b/i,
  /\bde toute évidence\b/i,
];

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
  if (hasEnglishMarkers(payload.caption)) return true;

  // Check caption quality: broken endings, repeated paragraphs, etc.
  if (hasCaptionQualityIssues(payload.caption)) return true;

  // Check narrative coherence: if slides 2+ repeat slide 1's heading
  if (payload.slides.length >= 2) {
    const h1 = payload.slides[0]!.heading.toLowerCase();
    for (let i = 1; i < payload.slides.length; i++) {
      const hi = payload.slides[i]!.heading.toLowerCase();
      if (hi === h1 || similarity(h1, hi) > 0.8) return true;
    }
  }

  // Check tone: AI filler / weak editorial language (PRD §9.3)
  const slideText = payload.slides
    .flatMap((s) => [s.heading, ...s.bullets])
    .join(" ");
  if (hasAIFillerPhrases(slideText) || hasAIFillerPhrases(payload.caption)) return true;

  // Check contrast-opener lone bullets — a slide whose only bullet starts with
  // "Mais/Cependant/Toutefois" is a mid-article fragment with no context.
  const CONTRAST_RE = /^(Mais|Cependant|Toutefois|Or,|Néanmoins|Pourtant|Malgré cela)\b/i;
  for (const slide of payload.slides) {
    if (slide.bullets.length === 1 && CONTRAST_RE.test(slide.bullets[0]!)) return true;
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
  /\bfull tuition\b/i, /\btuition\b/i, /\bstipend\b/i,
  /\bletter of recommendation\b/i, /\bprofessional experience\b/i,
  /\bcurrent employer\b/i, /\bstatement of purpose\b/i, /\btranscript\b/i,
  /\bwebsite\b/i, /\bportal\b/i, /\bstudents?\b/i,
];

function hasEnglishMarkers(text: string): boolean {
  let hits = 0;
  for (const re of EN_WORDS) {
    if (re.test(text)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/** Returns true when text contains AI-filler / weak editorial language (PRD §9.3). */
function hasAIFillerPhrases(text: string): boolean {
  return AI_FILLER_RE.some((re) => re.test(text));
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
   - Les slides 2+ doivent s'ouvrir par une phrase de transition logique:
     * "Concrètement..." ou "Concrètement, ..."
     * "Mais il y a plus..." ou "Le verdict est..."
     * "Ce qui a conduit à..." ou "À la suite de..."
     * Toute phrase qui lie la slide au contexte précédent.
   - En lisant slides 1→2→3→...→N, le lecteur doit comprendre une histoire fluide et complète.
   - La légende doit refléter le même arc narratif.
   - Aucune slide ne doit répéter le contenu d'une autre.
   - La légende ne doit pas répéter la même information d'un paragraphe à l'autre.
   - Aucun paragraphe de légende ne doit finir sur une phrase coupée, une ellipse ou une ponctuation suspendue.

3. EMOJIS: Maximum ${maxEmoji} emojis au total dans TOUTES les slides combinées.${igType === "histoire" ? " L'histoire demande de la gravité — très peu d'emojis." : ""}

4. ESTHÉTIQUE: PAS de parenthèses, PAS de crochets dans les slides.
   - Reécris "X (détail)" en "X — détail"
   - Supprime complètement "[...]"
   - Évite les asides parenthétiques comme "(selon la source)"
   - Les slides doivent être lisibles et épurées.

5. PREMIER SLIDE: Le heading de la slide 0 doit être un titre complet et percutant qui résume le sujet. Jamais un titre coupé en plein milieu d'une phrase.

6. NE CHANGE PAS la structure (nombre de slides, layout, backgroundImage). Corrige UNIQUEMENT heading, bullets, et caption.

7. TON ÉDITORIAL (PRD §9.3): Supprime les formulations creuses ou robotiques, remplace par des affirmations directes et factuelles:
   - "il est important de noter que X" → écris directement X
   - "il convient de souligner", "force est de constater", "il va sans dire" → reformule directement
   - "en conclusion", "comme mentionné", "comme nous l'avons vu" → supprime le preamble
   - "semble indiquer que", "pourrait potentiellement" → affirme ou précise le doute avec une source
   - "cet article explore", "dans cet article", "dans ce post" → supprime, reformule
   - "à noter que", "de toute évidence" → supprime
   Si une slide ou la légende contient ces formulations, réécris-les.

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

export interface IGPublishIssue {
  severity: "error" | "warning";
  message: string;
}

export interface IGPublishValidationResult {
  payload: IGFormattedPayload;
  issues: IGPublishIssue[];
  shouldHold: boolean;
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
  item?: Item,
): Promise<ReviewResult> {
  const normalizedPayload = normalizePayloadForPublishing(payload);

  // Quick check — skip LLM call if everything looks clean
  if (!needsReview(normalizedPayload, igType)) {
    return {
      corrected: false,
      corrections: [],
      payload: item ? applyFactGuardrails(normalizedPayload, item, igType) : normalizedPayload,
    };
  }

  console.log(`[ig-review] Reviewing ${igType} post (${normalizedPayload.slides.length} slides)...`);

  try {
    const prompt = buildReviewerPrompt(normalizedPayload, igType);
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
      return {
        corrected: false,
        corrections: [],
        payload: item ? applyFactGuardrails(normalizedPayload, item, igType) : normalizedPayload,
      };
    }

    // Apply corrections to a copy of the payload
    const corrected: IGFormattedPayload = {
      ...normalizedPayload,
      slides: normalizedPayload.slides.map((s) => ({ ...s, bullets: [...s.bullets] })),
      caption: normalizedPayload.caption,
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

    return {
      corrected: true,
      corrections,
      payload: item
        ? applyFactGuardrails(normalizePayloadForPublishing(corrected), item, igType)
        : normalizePayloadForPublishing(corrected),
    };
  } catch (err) {
    // Reviewer failure is non-fatal — return original payload
    console.warn(
      `[ig-review] Review failed, using original payload:`,
      err instanceof Error ? err.message : err,
    );
    return {
      corrected: false,
      corrections: [],
      payload: item ? applyFactGuardrails(normalizedPayload, item, igType) : normalizedPayload,
    };
  }
}

export function normalizePayloadForPublishing(payload: IGFormattedPayload): IGFormattedPayload {
  const slides = payload.slides.map((slide) => normalizeSlide(slide));
  return {
    ...payload,
    slides,
    caption: finalizeCaption(payload.caption),
  };
}

export function validatePayloadForPublishing(
  payload: IGFormattedPayload,
  igType: IGPostType,
): IGPublishValidationResult {
  const normalizedPayload = normalizePayloadForPublishing(payload);
  const issues: IGPublishIssue[] = [];

  if (normalizedPayload.slides.length === 0) {
    issues.push({ severity: "error", message: "Aucune slide à publier." });
  }

  // Single-slide post types are valid (PRD §6.1 breaking, §6.5 stat, taux)
  const SINGLE_SLIDE_TYPES = new Set<IGPostType>(["taux", "breaking", "stat"]);
  if (!SINGLE_SLIDE_TYPES.has(igType) && normalizedPayload.slides.length < 2) {
    issues.push({
      severity: "error",
      message: "Carrousel trop mince pour une publication éditoriale: au moins 2 slides sont requises.",
    });
  }

  if (normalizedPayload.caption.length < 140) {
    issues.push({
      severity: "error",
      message: "Légende trop courte pour un post Instagram éditorial.",
    });
  }

  if (hasCaptionQualityIssues(normalizedPayload.caption)) {
    issues.push({
      severity: "error",
      message: "La légende contient encore des répétitions ou une fin incomplète.",
    });
  }

  if (needsReview(normalizedPayload, igType)) {
    issues.push({
      severity: "error",
      message: "Le contenu présente encore des problèmes de langue ou de cohérence.",
    });
  }

  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    const slide = normalizedPayload.slides[i]!;
    if (!slide.heading.trim()) {
      issues.push({ severity: "error", message: `Slide ${i + 1}: titre vide.` });
    }

    const bulletSet = new Set<string>();
    for (const bullet of slide.bullets) {
      if (!bullet.trim()) {
        issues.push({ severity: "error", message: `Slide ${i + 1}: puce vide.` });
        continue;
      }
      const key = bullet.toLowerCase();
      if (bulletSet.has(key)) {
        issues.push({ severity: "error", message: `Slide ${i + 1}: puces dupliquées.` });
      }
      bulletSet.add(key);
    }
  }

  // PRD §7: Heading must be a short label, not a prose sentence.
  // Standard posts: ≤80 chars. Histoire posts: ≤150 chars (historical event
  // titles are naturally longer, e.g. treaties, battles, independence acts.
  // Previous limit of 120 caused most histoire posts to trigger shouldHold
  // and get trapped in manual-review limbo until they expired — never posting).
  const DATA_MISSING_SLIDE_RE =
    /\b(pas|non)\s+(disponible|détaillé|précisé|mentionné|indiqué|fourni|spécifié|inclus?|abordé)\b/i;
  const headingMaxChars = igType === "histoire" ? 150 : 80;

  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    const slide = normalizedPayload.slides[i]!;
    if (slide.layout !== "cta" && slide.heading.length > headingMaxChars) {
      issues.push({
        severity: "error",
        message: `Slide ${
          i + 1
        }: titre trop long (${
          slide.heading.length
        } chars, max ${headingMaxChars}). Le titre ne doit pas être une phrase complète.`,
      });
    }
    if (
      DATA_MISSING_SLIDE_RE.test(slide.heading) ||
      slide.bullets.some((b) => DATA_MISSING_SLIDE_RE.test(b))
    ) {
      issues.push({
        severity: "warning",
        message: `Slide ${
          i + 1
        }: contient une admission que les données sont manquantes — à reformuler ou supprimer.`,
      });
    }
  }

  // Cross-slide bullet deduplication: same bullet text on two different slides.
  const bulletIndex = new Map<string, number>();
  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    for (const bullet of normalizedPayload.slides[i]!.bullets) {
      const key = bullet.toLowerCase().trim();
      if (key.length < 10) continue;
      const seenOn = bulletIndex.get(key);
      if (seenOn !== undefined && seenOn !== i) {
        issues.push({
          severity: "error",
          message: `Slides ${
            seenOn + 1
          } et ${
            i + 1
          }: même puce dupliquée sur deux slides différentes.`,
        });
      } else {
        bulletIndex.set(key, i);
      }
    }
  }

  // Cross-slide similarity: histoire posts get a higher threshold (0.88)
  // because slides about events in the same era legitimately share vocabulary
  // (dates, proper nouns, French historical terms) without being duplicates.
  // Previous threshold of 0.82 caused most histoire posts to trigger
  // shouldHold via needsReview() and expire in manual-review limbo.
  const similarityThreshold = igType === "histoire" ? 0.88 : 0.72;
  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    for (let j = i + 1; j < normalizedPayload.slides.length; j++) {
      const left = slideText(normalizedPayload.slides[i]!);
      const right = slideText(normalizedPayload.slides[j]!);
      const similarityScore = similarity(left, right);
      if (similarityScore >= similarityThreshold) {
        issues.push({
          severity: "error",
          message: `Slides ${i + 1} et ${j + 1}: contenu trop similaire.`,
        });
      }
    }
  }

  return {
    payload: normalizedPayload,
    issues,
    shouldHold: issues.some((issue) => issue.severity === "error"),
  };
}

function applyFactGuardrails(
  payload: IGFormattedPayload,
  item: Item,
  igType: IGPostType,
): IGFormattedPayload {
  const corrected: IGFormattedPayload = {
    ...payload,
    slides: payload.slides.map((slide) => ({ ...slide, bullets: [...slide.bullets] })),
  };

  const deadlineIso = item.deadline ?? item.opportunity?.deadline;
  if ((igType === "scholarship" || igType === "opportunity") && deadlineIso) {
    const deadlineText = formatDeadline(deadlineIso);
    const captionDeadlineLine = `Date limite — ${deadlineText}`;

    if (/Date limite/i.test(corrected.caption)) {
      corrected.caption = corrected.caption.replace(/Date limite\s*[—:-].*/i, captionDeadlineLine);
    } else {
      corrected.caption = `${corrected.caption}\n\n${captionDeadlineLine}`;
    }

    for (const slide of corrected.slides) {
      slide.bullets = slide.bullets.map((bullet) =>
        /^Date limite\s*[:—-]/i.test(bullet)
          ? `Date limite: ${deadlineText}`
          : bullet,
      );
    }
  }

  if (igType === "scholarship" && item.opportunity?.coverage) {
    const coverageLine = `Couverture — ${ensureFrenchOpportunityCopy(
      item.opportunity.coverage,
      "Financement disponible selon le programme",
    )}`;
    if (/Couverture/i.test(corrected.caption)) {
      corrected.caption = corrected.caption.replace(/Couverture\s*[—:-].*/i, coverageLine);
    } else {
      corrected.caption = `${corrected.caption}\n${coverageLine}`;
    }
  }

  const sourceLine = buildSourceLine(item);
  if (!corrected.caption.toLowerCase().includes(sourceLine.toLowerCase())) {
    corrected.caption = `${corrected.caption}\n\n${sourceLine}`;
  }

  corrected.caption = finalizeCaption(corrected.caption);
  return normalizePayloadForPublishing(corrected);
}

function normalizeSlide(slide: IGSlide): IGSlide {
  const bullets: string[] = [];
  const seen = new Set<string>();

  for (const bullet of slide.bullets) {
    const normalizedBullet = normalizeLine(bullet);
    if (!normalizedBullet) continue;
    const key = normalizedBullet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bullets.push(normalizedBullet);
  }

  return {
    ...slide,
    heading: normalizeLine(slide.heading),
    bullets,
    ...(slide.footer ? { footer: normalizeLine(slide.footer) } : {}),
  };
}

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function slideText(slide: IGSlide): string {
  return [slide.heading, ...slide.bullets].join(" ").trim();
}
