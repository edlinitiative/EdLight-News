/**
 * IG Formatter – Utility carousel (taux du jour, study guides, career, etc.)
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText, formatDeadline, shortenHeadline, type BilingualText } from "./helpers.js";

export function buildUtilityCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
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

  // Slide 2: Practical info
  const facts = item.utilityMeta?.extractedFacts;
  if (facts) {
    const bullets: string[] = [];
    if (facts.deadlines?.length) {
      for (const d of facts.deadlines.slice(0, 3)) {
        bullets.push(`${d.label}: ${formatDeadline(d.dateISO)}`);
      }
    }
    if (facts.requirements?.length) {
      for (const r of facts.requirements.slice(0, 3)) {
        bullets.push(r);
      }
    }
    if (facts.steps?.length) {
      for (const s of facts.steps.slice(0, 3)) {
        bullets.push(s);
      }
    }
    if (bullets.length > 0) {
      slides.push({ heading: "Infos pratiques", bullets, layout: "explanation" });
    }
  }

  // Slide 3: Notes
  if (facts?.notes?.length) {
    slides.push({
      heading: "À retenir",
      bullets: facts.notes.slice(0, 4),
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
