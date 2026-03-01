/**
 * IG Formatter – Utility carousel (taux du jour, study guides, career, etc.)
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText, formatDeadline } from "./helpers.js";

export function buildUtilityCarousel(item: Item): IGFormattedPayload {
  const slides: IGSlide[] = [];

  // Slide 1: Title + summary
  const bullets1: string[] = [shortenText(item.summary, 200)];
  slides.push({
    heading: shortenText(item.title, 80),
    bullets: bullets1,
  });

  // Slide 2: Extracted facts (deadlines, requirements, steps)
  const facts = item.utilityMeta?.extractedFacts;
  if (facts) {
    const bullets2: string[] = [];

    if (facts.deadlines?.length) {
      for (const d of facts.deadlines.slice(0, 3)) {
        bullets2.push(`📅 ${d.label}: ${formatDeadline(d.dateISO)}`);
      }
    }
    if (facts.requirements?.length) {
      for (const r of facts.requirements.slice(0, 3)) {
        bullets2.push(`📋 ${r}`);
      }
    }
    if (facts.steps?.length) {
      for (const s of facts.steps.slice(0, 3)) {
        bullets2.push(`➡️ ${s}`);
      }
    }

    if (bullets2.length > 0) {
      slides.push({ heading: "Infos pratiques", bullets: bullets2 });
    }
  }

  // Slide 3: Tips or notes
  if (facts?.notes?.length) {
    slides.push({
      heading: "À retenir",
      bullets: facts.notes.slice(0, 4).map((n) => `💡 ${n}`),
      footer: buildSourceLine(item),
    });
  }

  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption
  const parts: string[] = [
    `💡 ${item.title}`,
    "",
    shortenText(item.summary, 400),
    "",
    buildCTA(),
    "",
    buildSourceLine(item),
  ];

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
