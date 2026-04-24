/**
 * IG Formatter – Daily Summary Story (v2 — Morning Briefing)
 *
 * Redesigned premium morning briefing:
 *   Frame 1 — Taux du jour (BRH exchange rate snapshot)
 *   Frame 2 — Faits du jour (all facts of the day on one polished frame)
 *   Frames 3-6 — Up to 4 bonus headline items (highest score, deadline-biased)
 *   Frame 7 — CTA ("Suivez @edlightnews")  ← auto-appended by renderer
 *
 * Design principles for Stories:
 *  - Each frame must be scannable in ≤ 5 seconds
 *  - Max 2 bullets per headline frame (summary + optional deadline)
 *  - Source attribution as a separate line, not a bullet
 *  - Emoji-free headings for a clean editorial look
 *  - Bilingual: French heading, optional Kreyòl bullet
 */

import type { Item, IGStoryPayload, IGStorySlide } from "@edlight-news/types";
import {
  shortenCaptionText,
  shortenHeadline,
  type BilingualText,
} from "./helpers.js";

// ── Accent colours per item category ──────────────────────────────────────

const CATEGORY_ACCENTS: Record<string, string> = {
  scholarship: "#3b82f6",
  opportunity: "#8b5cf6",
  news: "#14b8a6",
  local_news: "#14b8a6",
  event: "#f97316",
  resource: "#10b981",
  bourses: "#3b82f6",
  histoire: "#f59e0b",
  utility: "#34d399",
};

/** Short French category labels for inline context on the heading. */
const CATEGORY_LABELS: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news: "ACTUALITÉ",
  local_news: "HAÏTI",
  event: "ÉVÉNEMENT",
  resource: "RESSOURCE",
  bourses: "BOURSE",
  histoire: "HISTOIRE",
  utility: "LE SAVIEZ-VOUS ?",
};

export interface StoryItemInput {
  item: Item;
  bi?: BilingualText;
  /** igType from the IG queue — overrides item.category for label/accent to prevent misclassification */
  igType?: string;
  /** Optional premium background carried over from the queue payload */
  backgroundImage?: string;
}

/** Taux data passed from the worker to build the taux story frame. */
export interface StoryTauxInput {
  /** Main BRH reference rate string, e.g. "131.2589" */
  rate: string;
  /** Date label for the rate, e.g. "13 mars 2026" */
  dateLabel: string;
  /** Optional buy/sell summary bullets */
  bullets?: string[];
  /** Optional background image carried over from the taux post */
  backgroundImage?: string;
}

/** Facts of the day data for the facts story frame. */
export interface StoryFactsInput {
  /** Array of fact lines for the daily fact/story recap frame(s) */
  facts: string[];
  /** Optional background image to make the facts frame more lively */
  backgroundImage?: string;
}

/**
 * History/Almanach data for the editorial single-fact story frame.
 *
 * Used by HaitiHistory (igType="histoire") and HaitiFactOfTheDay
 * (igType="utility") per-post stories so the story matches the polished
 * carousel treatment instead of falling through to the generic facts card.
 */
export interface StoryHistoryInput {
  /** Display headline (e.g. the historical event title or fact subject) */
  heading: string;
  /** The narrative lede — set in editorial serif on the story */
  lede: string;
  /** Optional supporting notes (dates, context, sources) */
  notes?: string[];
  /** Eyebrow label override; defaults to "HISTOIRE" or "LE SAVIEZ-VOUS ?" */
  eyebrow?: string;
  /** Accent override; defaults to orange for histoire, emerald for utility */
  accent?: string;
  /** Source attribution line (e.g. "Source: AyiboPost") */
  footer?: string;
  /** Optional background image (will be darkened by the renderer) */
  backgroundImage?: string;
  /** Variant — controls default eyebrow + accent when not overridden */
  variant?: "histoire" | "utility";
}

const STORY_MAX_FACTS = 5;
const STORY_MAX_FACT_FRAMES = 2;
const STORY_MAX_FACTS_PER_FRAME = 3;
const STORY_FACT_FRAME_CHAR_BUDGET = 420;
const STORY_MAX_HEADLINES = 4;
const STORY_HEADLINE_MAX_WORDS = 16;
const STORY_HEADLINE_MAX_CHARS = 118;

function formatStoryDeadline(deadline: string): string | null {
  try {
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function pickStorySourceName(item: Item): string {
  return item.source?.name ?? item.citations?.[0]?.sourceName ?? "";
}

function pickStorySourceFooter(item: Item): string | undefined {
  const sourceName = pickStorySourceName(item);
  if (!sourceName) return undefined;
  return `Source: ${sourceName}`;
}

function buildStorySummary(summary: string, hasDeadline: boolean): string {
  const max = hasDeadline ? 210 : 250;
  return shortenCaptionText(summary, max);
}

function buildStoryMeta(item: Item): string[] {
  const meta: string[] = [];
  const deadline = item.deadline ? formatStoryDeadline(item.deadline) : null;

  if (deadline) meta.push(`Date limite : ${deadline}`);

  return meta;
}

function chunkStoryFacts(facts: string[]): string[][] {
  const cleaned = facts
    .map((fact) => fact.trim())
    .filter((fact) => fact.length > 0)
    .slice(0, STORY_MAX_FACTS);

  if (cleaned.length === 0) return [];

  const chunks: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const fact of cleaned) {
    const wouldOverflow =
      current.length >= STORY_MAX_FACTS_PER_FRAME ||
      (current.length > 0 &&
        currentChars + fact.length > STORY_FACT_FRAME_CHAR_BUDGET);

    if (wouldOverflow && chunks.length < STORY_MAX_FACT_FRAMES - 1) {
      chunks.push(current);
      current = [fact];
      currentChars = fact.length;
      continue;
    }

    current.push(fact);
    currentChars += fact.length;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Build the daily summary story payload (v2 — Morning Briefing).
 *
 * @param items  - Ranked array of bonus items (best first), ideally 3-5
 * @param date   - The date for the story (defaults to today)
 * @param taux   - Optional BRH exchange rate data for the taux frame
 * @param factsInput - Optional facts of the day for the facts frame
 * @returns      - IGStoryPayload with taux + facts + bonus headlines
 *                (CTA frame is auto-appended by the renderer)
 */
export function buildDailySummaryStory(
  items: StoryItemInput[],
  date?: Date,
  taux?: StoryTauxInput,
  factsInput?: StoryFactsInput,
): IGStoryPayload {
  const d = date ?? new Date();
  const dateLabel = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const slides: IGStorySlide[] = [];

  // ── Frame 1: Taux du jour ──────────────────────────────────────────────
  if (taux) {
    const tauxBullets = taux.bullets ?? [];
    slides.push({
      heading: taux.rate,
      bullets: [taux.dateLabel, ...tauxBullets],
      accent: "#eab308",
      backgroundImage: taux.backgroundImage,
      frameType: "taux",
    });
  }

  // ── Frame 2: Faits du jour ─────────────────────────────────────────────
  if (factsInput && factsInput.facts.length > 0) {
    const factChunks = chunkStoryFacts(factsInput.facts);
    for (let i = 0; i < factChunks.length; i++) {
      slides.push({
        heading: i === 0 ? "Repères du jour" : "Ce qu'il faut retenir",
        bullets: factChunks[i]!,
        eyebrow: i === 0 ? "Ce matin" : "Suite",
        accent: "#34d399",
        backgroundImage: factsInput.backgroundImage,
        frameType: "facts",
      });
    }
  }

  // ── Frames 3-6: Bonus headline items (max 4) ──────────────────────────
  const headlineCount = Math.min(items.length, STORY_MAX_HEADLINES);

  for (let i = 0; i < headlineCount; i++) {
    const { item, bi, igType, backgroundImage } = items[i]!;
    const title = bi?.frTitle ?? item.title;
    const summary = bi?.frSummary ?? item.summary;
    // Prefer igType from the queue (correct, post-validated) over raw item.category
    // which can be mis-classified (e.g. an arrest story tagged as "scholarship" by Gemini).
    const cat = igType ?? item.category ?? "news";
    const catLabel =
      CATEGORY_LABELS[cat] ?? CATEGORY_LABELS[item.category ?? "news"] ?? "";
    const hasDeadline = !!formatStoryDeadline(item.deadline ?? "");
    const subheading = buildStorySummary(summary, hasDeadline);
    const meta = buildStoryMeta(item);
    const footer = pickStorySourceFooter(item);
    const bullets = [subheading, ...meta].filter((entry) => entry.length > 0);

    slides.push({
      heading: shortenHeadline(
        title,
        STORY_HEADLINE_MAX_WORDS,
        STORY_HEADLINE_MAX_CHARS,
      ),
      bullets,
      eyebrow: catLabel || "À LA UNE",
      subheading,
      meta,
      footer,
      accent: CATEGORY_ACCENTS[cat],
      backgroundImage: backgroundImage ?? item.imageUrl ?? undefined,
      frameType: "headline",
    });
  }

  // If no frames at all (no taux, no facts, no items), add a basic cover
  if (slides.length === 0) {
    slides.push({
      heading: "Résumé du jour",
      bullets: ["Aucune actualité aujourd'hui"],
      frameType: "cover",
    });
  }

  return { slides, dateLabel };
}
// ── Per-post story builder ────────────────────────────────────────────────
// Builds a single story frame for an individual post (called from
// processIgScheduled right after a carousel posts successfully).
// This replaces the monolithic morning-briefing approach where one big
// story is blocked until ALL staples are posted.

/**
 * Build a single-frame story payload for an individual IG post.
 *
 * Called immediately after a carousel post publishes so followers see a
 * story frame promoting that content within seconds — no waiting for
 * other posts.  If one post fails, the next one still gets its story.
 *
 * @param input  - The item data + optional bilingual text + igType
 * @param taux   - If the post is a taux item, provide the rate data instead
 * @param facts  - If the post is a facts/utility item, provide the facts
 * @param history - If the post is a HaitiHistory or HaitiFactOfTheDay item,
 *                  provide editorial almanach data for the polished story frame
 * @returns      - A single-slide IGStoryPayload ready for rendering
 */
export function buildStorySlideForPost(
  input?: StoryItemInput,
  taux?: StoryTauxInput,
  facts?: StoryFactsInput,
  history?: StoryHistoryInput,
): IGStoryPayload {
  const d = new Date();
  const dateLabel = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const slides: IGStorySlide[] = [];

  if (taux) {
    const tauxBullets = taux.bullets ?? [];
    slides.push({
      heading: taux.rate,
      bullets: [taux.dateLabel, ...tauxBullets],
      accent: "#eab308",
      backgroundImage: taux.backgroundImage,
      frameType: "taux",
    });
  } else if (history) {
    const variant = history.variant ?? "histoire";
    const defaultAccent = variant === "histoire" ? "#f59e0b" : "#34d399";
    const defaultEyebrow =
      variant === "histoire" ? "HISTOIRE" : "LE SAVIEZ-VOUS ?";
    const accent = history.accent ?? defaultAccent;
    const eyebrow = (history.eyebrow ?? defaultEyebrow).trim() || defaultEyebrow;
    const lede = history.lede.trim();
    const notes = (history.notes ?? [])
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    slides.push({
      heading: history.heading,
      bullets: [lede, ...notes].filter((entry) => entry.length > 0),
      eyebrow,
      subheading: lede,
      meta: notes,
      footer: history.footer,
      accent,
      backgroundImage: history.backgroundImage,
      frameType: "history",
    });
  } else if (facts && facts.facts.length > 0) {
    // For facts/utility, use a single frame (no chunking for per-post stories)
    slides.push({
      heading: "Repères du jour",
      bullets: facts.facts.slice(0, STORY_MAX_FACTS_PER_FRAME),
      eyebrow: "Ce matin",
      accent: "#34d399",
      backgroundImage: facts.backgroundImage,
      frameType: "facts",
    });
  } else if (input) {
    const { item, bi, igType, backgroundImage } = input;
    const title = bi?.frTitle ?? item.title;
    const summary = bi?.frSummary ?? item.summary;
    const cat = igType ?? item.category ?? "news";
    const catLabel =
      CATEGORY_LABELS[cat] ?? CATEGORY_LABELS[item.category ?? "news"] ?? "";
    const hasDeadline = !!formatStoryDeadline(item.deadline ?? "");
    const subheading = buildStorySummary(summary, hasDeadline);
    const meta = buildStoryMeta(item);
    const footer = pickStorySourceFooter(item);
    const bullets = [subheading, ...meta].filter((entry) => entry.length > 0);

    slides.push({
      heading: shortenHeadline(
        title,
        STORY_HEADLINE_MAX_WORDS,
        STORY_HEADLINE_MAX_CHARS,
      ),
      bullets,
      eyebrow: catLabel || "À LA UNE",
      subheading,
      meta,
      footer,
      accent: CATEGORY_ACCENTS[cat],
      backgroundImage: backgroundImage ?? item.imageUrl ?? undefined,
      frameType: "headline",
    });
  }

  return { slides, dateLabel };
}