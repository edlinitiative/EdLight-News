/**
 * IG Formatter – Opportunity carousel
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, formatDeadline, buildSourceLine, shortenText } from "./helpers.js";

export function buildOpportunityCarousel(item: Item): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;

  // Slide 1: Title + overview
  const bullets1: string[] = [];
  if (deadlineStr) bullets1.push(`📅 Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.coverage) bullets1.push(`💰 ${item.opportunity.coverage}`);
  if (item.geoTag) {
    const label = item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International";
    bullets1.push(`🌍 ${label}`);
  }
  slides.push({
    heading: shortenText(item.title, 80),
    bullets: bullets1.length > 0 ? bullets1 : ["🚀 Opportunité disponible"],
  });

  // Slide 2: Eligibility
  const bullets2: string[] = [];
  if (item.opportunity?.eligibility?.length) {
    for (const e of item.opportunity.eligibility.slice(0, 4)) {
      bullets2.push(`✅ ${e}`);
    }
  }
  if (bullets2.length > 0) {
    slides.push({ heading: "Qui peut postuler?", bullets: bullets2 });
  }

  // Slide 3: How to apply + source
  const bullets3: string[] = [];
  if (item.opportunity?.howToApply) bullets3.push(item.opportunity.howToApply);
  if (item.opportunity?.officialLink) bullets3.push(`🔗 ${item.opportunity.officialLink}`);
  if (bullets3.length > 0) {
    slides.push({ heading: "Comment postuler", bullets: bullets3, footer: buildSourceLine(item) });
  }

  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption
  const parts: string[] = [
    `🚀 ${item.title}`,
    "",
    shortenText(item.summary, 300),
  ];
  if (deadlineStr) parts.push("", `📅 Date limite: ${formatDeadline(deadlineStr)}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
