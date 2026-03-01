/**
 * IG Formatter – Scholarship carousel
 *
 * Builds structured slides + caption from normalized Item fields.
 * Never invents facts — only uses existing content fields.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, formatDeadline, buildSourceLine } from "./helpers.js";

export function buildScholarshipCarousel(item: Item): IGFormattedPayload {
  const slides: IGSlide[] = [];

  // Slide 1: Title + key info
  const bullets1: string[] = [];
  if (item.opportunity?.coverage) bullets1.push(`💰 ${item.opportunity.coverage}`);
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;
  if (deadlineStr) bullets1.push(`📅 Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.geoTag) bullets1.push(`🌍 ${item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International"}`);

  slides.push({
    heading: item.title.length > 80 ? item.title.slice(0, 77) + "…" : item.title,
    bullets: bullets1.length > 0 ? bullets1 : ["📚 Bourse disponible"],
  });

  // Slide 2: Eligibility + requirements
  const bullets2: string[] = [];
  if (item.opportunity?.eligibility?.length) {
    for (const e of item.opportunity.eligibility.slice(0, 4)) {
      bullets2.push(`✅ ${e}`);
    }
  }
  if (bullets2.length > 0) {
    slides.push({ heading: "Conditions d'éligibilité", bullets: bullets2 });
  }

  // Slide 3: How to apply
  const bullets3: string[] = [];
  if (item.opportunity?.howToApply) {
    bullets3.push(item.opportunity.howToApply);
  }
  if (item.opportunity?.officialLink) {
    bullets3.push(`🔗 Lien officiel: ${item.opportunity.officialLink}`);
  }
  if (bullets3.length > 0) {
    slides.push({
      heading: "Comment postuler",
      bullets: bullets3,
      footer: buildSourceLine(item),
    });
  }

  // Ensure at least source footer on last slide
  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption
  const captionParts: string[] = [
    `🎓 ${item.title}`,
    "",
    item.summary,
  ];
  if (deadlineStr) captionParts.push("", `📅 Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.coverage) captionParts.push(`💰 ${item.opportunity.coverage}`);
  captionParts.push("", buildCTA(), "", buildSourceLine(item));

  const caption = truncateCaption(captionParts.join("\n"));

  return { slides, caption };
}
