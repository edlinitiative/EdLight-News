/**
 * IG Formatter – Daily Summary Story
 *
 * Takes the top N items of the day and produces a multi-frame
 * 1080×1920 story: cover → headline frames → (CTA auto-appended by renderer).
 *
 * Design principles for Stories:
 *  - Each frame must be scannable in ≤ 5 seconds
 *  - Max 2 bullets per headline frame (summary + optional Kreyòl/deadline)
 *  - Source attribution as a separate line, not a bullet
 *  - Emoji-free headings for a clean editorial look
 *  - Bilingual: French heading, optional Kreyòl bullet
 */

import type { Item, IGStoryPayload, IGStorySlide } from "@edlight-news/types";
import { shortenText, type BilingualText } from "./helpers.js";

// ── Accent colours per item category ──────────────────────────────────────

const CATEGORY_ACCENTS: Record<string, string> = {
  scholarship: "#3b82f6",
  opportunity: "#8b5cf6",
  news:        "#14b8a6",
  local_news:  "#14b8a6",
  event:       "#f97316",
  resource:    "#10b981",
  bourses:     "#3b82f6",
};

/** Short French category labels for inline context on the heading. */
const CATEGORY_LABELS: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news:        "ACTUALITÉ",
  local_news:  "HAÏTI",
  event:       "ÉVÉNEMENT",
  resource:    "RESSOURCE",
  bourses:     "BOURSE",
};

export interface StoryItemInput {
  item: Item;
  bi?: BilingualText;
}

/**
 * Build the daily summary story payload from the top items of the day.
 *
 * @param items  - Ranked array of items (best first), ideally 3-5
 * @param date   - The date for the story (defaults to today)
 * @returns      - IGStoryPayload with cover + 1 frame per headline
 *                (CTA frame is auto-appended by the renderer)
 */
export function buildDailySummaryStory(
  items: StoryItemInput[],
  date?: Date,
): IGStoryPayload {
  const d = date ?? new Date();
  const dateLabel = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const slides: IGStorySlide[] = [];
  const headlineCount = Math.min(items.length, 5);

  // ── Cover frame ──────────────────────────────────────────────────────────
  const coverBullets: string[] = [
    `${headlineCount} actualité${headlineCount > 1 ? "s" : ""} à retenir aujourd'hui`,
  ];

  // Use the best item's image as cover background if available
  const coverImage = items.find((i) => i.item.imageUrl)?.item.imageUrl ?? undefined;

  slides.push({
    heading: "Résumé du jour",
    bullets: coverBullets,
    backgroundImage: coverImage,
  });

  // ── Headline frames (one per item, max 5) ────────────────────────────────
  // Each frame: clean heading + max 2 tight bullets (scannable in 5 s)
  for (let i = 0; i < headlineCount; i++) {
    const { item, bi } = items[i]!;
    const title = bi?.frTitle ?? item.title;
    const summary = bi?.frSummary ?? item.summary;
    const cat = item.category ?? "news";
    const catLabel = CATEGORY_LABELS[cat] ?? "";

    // Tight bullets — max 2 for fast scanning
    const bullets: string[] = [shortenText(summary, 140)];

    // Second bullet: prefer deadline for scholarships, else Kreyòl hint
    if (item.deadline) {
      try {
        const dl = new Date(item.deadline);
        const dlStr = dl.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        bullets.push(`⏰ Date limite: ${dlStr}`);
      } catch {
        // fallback to Kreyòl if deadline can't be parsed
        if (bi?.htSummary) {
          bullets.push(`🇭🇹 ${shortenText(bi.htSummary, 100)}`);
        }
      }
    } else if (bi?.htSummary) {
      bullets.push(`🇭🇹 ${shortenText(bi.htSummary, 100)}`);
    }

    // Source as a separate styled line (renderer handles it differently)
    const sourceName = item.source?.name ?? item.citations?.[0]?.sourceName ?? "";
    if (sourceName) {
      bullets.push(`Source: ${sourceName}`);
    }

    slides.push({
      heading: catLabel ? `${catLabel} — ${shortenText(title, 75)}` : shortenText(title, 85),
      bullets,
      accent: CATEGORY_ACCENTS[cat],
    });
  }

  return { slides, dateLabel };
}
