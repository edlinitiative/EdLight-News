/**
 * IG Formatter – Breaking News single-slide (MASTER_PROMPT Template 1)
 *
 * "For urgent updates, quick announcements, headline-driven stories."
 *
 * Structure (1 slide, "headline" layout):
 *   - category pill: FLASH
 *   - bold headline (max 10 words)
 *   - optional one-liner from summary (max 18 words)
 *   - strong full-bleed image
 *   - source/geo footer
 *
 * Routing: auto-selected for news items with 80–199 words of body text.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import {
  buildCaption,
  buildSourceFooter,
  buildSourceLine,
  shortenHeadline,
  type BilingualText,
} from "./helpers.js";

export function buildBreakingNewsPost(item: Item, bi?: BilingualText): IGFormattedPayload {
  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary ?? "";
  const imageUrl = item.imageUrl ?? undefined;

  // Supporting one-liner: first 10 words of summary
  // (supportLine box is 900×110px at 30px — fits ~2 lines; keep margin)
  const words = summary.split(/\s+/).filter(Boolean);
  const supporting =
    words.length > 0
      ? words.slice(0, 10).join(" ") + (words.length > 10 ? "…" : "")
      : "";

  const slides: IGSlide[] = [
    {
      heading: shortenHeadline(title, 10),
      bullets: supporting ? [supporting] : [],
      layout: "headline",
      footer: buildSourceFooter(item),
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    },
  ];

  return {
    slides,
    caption: buildCaption({
      title,
      summary,
      htSummary: bi?.htSummary,
      sourceLine: buildSourceLine(item),
      hashtags: "#Flash #ActuHaïti #EdLightNews",
      summaryCap: 280,
    }),
  };
}
