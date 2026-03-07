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

  // Slide 2: Key facts — use cleaned + split pipeline for quality sentences
  let facts: string[] = [];
  if (item.extractedText) {
    const cleaned = cleanExtractedText(item.extractedText);
    facts = splitSentences(cleaned)
      .filter((s) => s.length >= 20 && s.length <= 180)
      .filter((s) => !isJunkSentence(s))
      .slice(0, 4);
  }
  // Fallback: extract sentences from summary if extractedText produced too few
  if (facts.length < 2 && summary) {
    const summaryFacts = splitSentences(summary)
      .filter((s) => s.length >= 20 && s.length <= 180)
      .filter((s) => !isJunkSentence(s));
    // Merge, dedupe
    for (const sf of summaryFacts) {
      if (!facts.includes(sf)) facts.push(sf);
      if (facts.length >= 4) break;
    }
  }
  if (facts.length >= 1) {
    slides.push({
      heading: "Le saviez-vous",
      bullets: facts,
      layout: "explanation",
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  // Slide 3: Further reading
  if (item.utilityMeta?.citations?.length) {
    slides.push({
      heading: "Pour aller plus loin",
      bullets: item.utilityMeta.citations.slice(0, 3).map((c) => c.label),
      layout: "explanation",
      footer: buildSourceLine(item),
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
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
  parts.push("", "#IstwaAyiti #HistoireHaïti #EdLightNews");
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
