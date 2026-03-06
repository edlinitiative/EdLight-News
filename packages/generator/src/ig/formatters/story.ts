/**
 * IG Formatter – Daily Summary Story
 *
 * Takes the top N items of the day and produces a multi-frame
 * 1080×1920 story: cover → headlines 1-5 → closing CTA.
 *
 * Bilingual: headings in French, bullets may include Kreyòl hints.
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

const CATEGORY_EMOJI: Record<string, string> = {
  scholarship: "🎓",
  opportunity: "🚀",
  news:        "📰",
  local_news:  "🇭🇹",
  event:       "📅",
  resource:    "📚",
  bourses:     "🎓",
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
 * @returns      - IGStoryPayload with cover + 1 frame per item
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

  // ── Cover frame ──────────────────────────────────────────────────────────
  const headlineCount = Math.min(items.length, 5);
  const coverBullets: string[] = [
    `${headlineCount} actualité${headlineCount > 1 ? "s" : ""} à retenir`,
    "Éducation · Bourses · Haïti",
  ];

  // Use the best item's image as cover background if available
  const coverImage = items.find((i) => i.item.imageUrl)?.item.imageUrl ?? undefined;

  slides.push({
    heading: `Résumé du jour`,
    bullets: coverBullets,
    backgroundImage: coverImage,
  });

  // ── Headline frames (one per item, max 5) ────────────────────────────────
  for (let i = 0; i < headlineCount; i++) {
    const { item, bi } = items[i]!;
    const title = bi?.frTitle ?? item.title;
    const summary = bi?.frSummary ?? item.summary;
    const cat = item.category ?? "news";
    const emoji = CATEGORY_EMOJI[cat] ?? "📰";

    const bullets: string[] = [shortenText(summary, 200)];

    // Add Kreyòl hint if available
    if (bi?.htSummary) {
      bullets.push(`🇭🇹 ${shortenText(bi.htSummary, 140)}`);
    }

    // Deadline callout for scholarships / opportunities
    if (item.deadline) {
      try {
        const dl = new Date(item.deadline);
        const dlStr = dl.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        bullets.push(`⏰ Date limite: ${dlStr}`);
      } catch {
        // ignore bad deadline
      }
    }

    const sourceName = item.source?.name ?? item.citations?.[0]?.sourceName ?? "";
    if (sourceName) {
      bullets.push(`Source: ${sourceName}`);
    }

    slides.push({
      heading: `${emoji} ${shortenText(title, 90)}`,
      bullets,
      accent: CATEGORY_ACCENTS[cat],
    });
  }

  return { slides, dateLabel };
}
