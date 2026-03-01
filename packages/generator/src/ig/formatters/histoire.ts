/**
 * IG Formatter – Histoire carousel
 *
 * Designed for HaitiHistory, HaitiFactOfTheDay, HaitianOfTheWeek utility items.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText } from "./helpers.js";

export function buildHistoireCarousel(item: Item): IGFormattedPayload {
  const slides: IGSlide[] = [];

  // Slide 1: Title + summary
  slides.push({
    heading: shortenText(item.title, 80),
    bullets: [shortenText(item.summary, 200)],
  });

  // Slide 2: Key facts from extracted text or sections
  if (item.extractedText) {
    const facts = item.extractedText
      .split(/[.!?]\s+/)
      .filter((s) => s.trim().length > 15 && s.trim().length < 120)
      .slice(0, 4)
      .map((s) => `📌 ${s.trim()}`);

    if (facts.length >= 1) {
      slides.push({
        heading: "Le saviez-vous?",
        bullets: facts,
      });
    }
  }

  // Slide 3: Student takeaway (if utility meta has citations)
  if (item.utilityMeta?.citations?.length) {
    const citBullets = item.utilityMeta.citations
      .slice(0, 3)
      .map((c) => `📖 ${c.label}`);
    slides.push({
      heading: "Pour aller plus loin",
      bullets: citBullets,
      footer: buildSourceLine(item),
    });
  }

  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption
  const emoji = item.utilityMeta?.series === "HaitianOfTheWeek" ? "🇭🇹" : "📜";
  const parts: string[] = [
    `${emoji} ${item.title}`,
    "",
    shortenText(item.summary, 400),
    "",
    buildCTA(),
    "",
    buildSourceLine(item),
  ];

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
