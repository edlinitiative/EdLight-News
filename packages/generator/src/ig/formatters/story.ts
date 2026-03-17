/**
 * IG Formatter – Daily Summary Story (v2 — Morning Briefing)
 *
 * Redesigned premium morning briefing:
 *   Frame 1 — Taux du jour (BRH exchange rate snapshot)
 *   Frame 2 — Faits du jour (all facts of the day on one polished frame)
 *   Frames 3-6 — Up to 4 bonus headline items (highest score, deadline-biased)
 *   Frame 7 — CTA ("Suivez @edlight.news")  ← auto-appended by renderer
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
  /** Array of fact lines, each ≤100 chars */
  facts: string[];
  /** Optional background image to make the facts frame more lively */
  backgroundImage?: string;
}

const STORY_MAX_FACTS = 4;
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
    slides.push({
      heading: "Repères du jour",
      bullets: factsInput.facts.slice(0, STORY_MAX_FACTS),
      eyebrow: "Ce matin",
      accent: "#34d399",
      backgroundImage: factsInput.backgroundImage,
      frameType: "facts",
    });
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
