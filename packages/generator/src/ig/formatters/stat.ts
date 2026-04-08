/**
 * IG Formatter – Stat / Quote Card single-slide (MASTER_PROMPT Template 6)
 *
 * "For one powerful quote, one strong statistic, or one takeaway."
 *
 * Structure (1 slide, "data" layout):
 *   - category pill: DONNÉES
 *   - giant stat or key number as hero text
 *   - short description line
 *   - source footer
 *
 * Routing: manually triggered via `requeueIgItem --type=stat --id=<itemId>`.
 * The formatter extracts the first numeric stat from the title/summary
 * and renders it in the big-number data layout.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import {
  buildCaption,
  buildSourceFooter,
  buildSourceLine,
  shortenText,
  type BilingualText,
} from "./helpers.js";

/** Matches: "3,2 millions", "45%", "12 milliards HTG", plain integers, etc. */
const STAT_RE =
  /\b(\d[\d\s,.]*(?:\s*%|\s*M(?:USD|HTG|\$)?|\s*milliards?\b|\s*millions?\b|\s*mille\b)?)/i;

export function buildStatCard(item: Item, bi?: BilingualText): IGFormattedPayload {
  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary ?? "";

  const statMatch = title.match(STAT_RE);
  const statValue = statMatch ? statMatch[1].trim() : undefined;

  // Description: title with the matched stat removed, or fall back to summary
  const context = statValue
    ? title.replace(statMatch![0], "").replace(/^\s*[-:,]\s*/, "").trim()
    : "";
  const statDescription = shortenText(context || summary, 120);

  const slides: IGSlide[] = [
    {
      heading: statValue ?? shortenText(title, 80),
      statValue,
      statDescription,
      bullets: [],
      layout: "data",
      footer: buildSourceFooter(item),
      ...(item.imageUrl ? { backgroundImage: item.imageUrl } : {}),
    },
  ];

  return {
    slides,
    caption: buildCaption({
      title,
      summary,
      htSummary: bi?.htSummary,
      sourceLine: buildSourceLine(item),
      hashtags: "#ChiffreClé #EdLightNews #Haïti",
      summaryCap: 280,
    }),
  };
}
