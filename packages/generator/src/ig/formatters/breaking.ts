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

  const geoLabel =
    item.geoTag === "HT"
      ? "Haïti"
      : item.geoTag === "Diaspora"
        ? "Diaspora"
        : "International";

  // Supporting one-liner: first 18 words of summary
  const words = summary.split(/\s+/).filter(Boolean);
  const supporting =
    words.length > 0
      ? words.slice(0, 18).join(" ") + (words.length > 18 ? "…" : "")
      : "";

  const slides: IGSlide[] = [
    {
      heading: shortenHeadline(title, 10),
      bullets: supporting ? [supporting] : [],
      layout: "headline",
      footer: `${geoLabel} · ${buildSourceFooter(item)}`,
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
