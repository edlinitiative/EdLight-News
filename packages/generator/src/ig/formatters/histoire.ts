/**
 * IG Formatter – Histoire carousel
 *
 * Designed for HaitiHistory, HaitiFactOfTheDay, HaitianOfTheWeek utility items.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText } from "./helpers.js";
import { isJunkSentence } from "./news.js";

export function buildHistoireCarousel(item: Item): IGFormattedPayload {
  const slides: IGSlide[] = [];

  // Slide 1: Cover
  slides.push({
    heading: shortenText(item.title, 80),
    bullets: [shortenText(item.summary, 180)],
    backgroundImage: item.imageUrl ?? undefined,
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
      slides.push({ heading: "Le saviez-vous", bullets: facts });
    }
  }

  // Slide 3: Further reading
  if (item.utilityMeta?.citations?.length) {
    slides.push({
      heading: "Pour aller plus loin",
      bullets: item.utilityMeta.citations.slice(0, 3).map((c) => c.label),
      footer: buildSourceLine(item),
    });
  }

  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption
  const parts: string[] = [
    item.title,
    "",
    shortenText(item.summary, 400),
    "",
    buildCTA(),
    "",
    buildSourceLine(item),
  ];

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
