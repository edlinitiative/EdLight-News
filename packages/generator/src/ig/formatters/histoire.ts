/**
 * IG Formatter – Histoire carousel
 *
 * Designed for HaitiHistory, HaitiFactOfTheDay, HaitianOfTheWeek utility items.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText, shortenHeadline, type BilingualText } from "./helpers.js";
import { isJunkSentence, cleanExtractedText, splitSentences } from "./news.js";

export function buildHistoireCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;
  const imageUrl = item.imageUrl ?? undefined;

  // Slide 1: Cover
  slides.push({
    heading: shortenHeadline(title),
    bullets: [shortenText(summary, 180)],
    layout: "headline",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // Slide 2: Key facts — always produce this slide
  let facts: string[] = [];

  // Try extractedText first (most detail)
  if (item.extractedText) {
    const cleaned = cleanExtractedText(item.extractedText);
    facts = splitSentences(cleaned)
      .filter((s) => s.length >= 20 && s.length <= 200)
      .filter((s) => !isJunkSentence(s))
      .slice(0, 4);
  }

  // Always fall back to summary sentences if we don't have enough
  if (facts.length < 2 && summary) {
    const summaryFacts = splitSentences(summary)
      .filter((s) => s.length >= 15 && s.length <= 200)
      .filter((s) => !isJunkSentence(s));
    for (const sf of summaryFacts) {
      if (!facts.includes(sf)) facts.push(sf);
      if (facts.length >= 4) break;
    }
  }

  // If we still have nothing, use the full summary as a single bullet
  if (facts.length === 0 && summary) {
    facts = [shortenText(summary, 280)];
  }

  if (facts.length >= 1) {
    slides.push({
      heading: "Le saviez-vous ?",
      bullets: facts,
      layout: "explanation",
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  // Slide 3: Source + CTA (always — replaces the old "Pour aller plus loin")
  slides.push({
    heading: "En savoir plus",
    bullets: [
      "→ Lien dans la bio pour l'article complet",
      "→ Lyen nan biyo pou atik konplè a",
    ],
    layout: "explanation",
    footer: buildSourceLine(item),
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // Caption — bilingual
  const parts: string[] = [
    title,
    "",
    shortenText(summary, 400),
  ];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenText(bi.htSummary, 300)}`);
  parts.push("", "#IstwaAyiti #HistoireHaïti #EdLightNews");
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
