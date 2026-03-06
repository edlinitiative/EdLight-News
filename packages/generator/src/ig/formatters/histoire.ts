/**
 * IG Formatter – Histoire carousel
 *
 * Designed for HaitiHistory, HaitiFactOfTheDay, HaitianOfTheWeek utility items.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText, shortenHeadline, type BilingualText } from "./helpers.js";
import { isJunkSentence } from "./news.js";

export function buildHistoireCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;

  // Slide 1: Cover
  slides.push({
    heading: shortenHeadline(title),
    bullets: [shortenText(summary, 180)],
    layout: "headline",
    ...(item.imageUrl ? { backgroundImage: item.imageUrl } : {}),
  });

  // Slide 2: Key facts (with junk filtering)
  if (item.extractedText) {
    const facts = item.extractedText
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && s.length < 120)
      .filter((s) => !isJunkSentence(s))
      .slice(0, 4);

    if (facts.length >= 1) {
      slides.push({ heading: "Le saviez-vous", bullets: facts, layout: "explanation" });
    }
  }

  // Slide 3: Further reading
  if (item.utilityMeta?.citations?.length) {
    slides.push({
      heading: "Pour aller plus loin",
      bullets: item.utilityMeta.citations.slice(0, 3).map((c) => c.label),
      layout: "explanation",
      footer: buildSourceLine(item),
    });
  }

  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption — bilingual
  const parts: string[] = [
    title,
    "",
    shortenText(summary, 400),
  ];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenText(bi.htSummary, 300)}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
