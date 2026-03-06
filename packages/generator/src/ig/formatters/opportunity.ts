/**
 * IG Formatter – Opportunity carousel
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, formatDeadline, buildSourceLine, shortenText, humanizeUrl } from "./helpers.js";

export function buildOpportunityCarousel(item: Item): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;

  // Slide 1: Cover
  const meta: string[] = [];
  if (deadlineStr) meta.push(`Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.coverage) meta.push(item.opportunity.coverage);
  if (item.geoTag) {
    meta.push(item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International");
  }
  slides.push({
    heading: shortenText(item.title, 80),
    bullets: meta.length > 0 ? meta : ["Opportunité disponible"],
    ...(item.imageUrl ? { backgroundImage: item.imageUrl } : {}),
  });

  // Slide 2: Eligibility
  if (item.opportunity?.eligibility?.length) {
    slides.push({
      heading: "Qui peut postuler",
      bullets: item.opportunity.eligibility.slice(0, 4),
    });
  }

  // Slide 3: How to apply
  const applyBullets: string[] = [];
  if (item.opportunity?.howToApply) applyBullets.push(item.opportunity.howToApply);
  if (item.opportunity?.officialLink) applyBullets.push(humanizeUrl(item.opportunity.officialLink));
  if (applyBullets.length > 0) {
    slides.push({
      heading: "Comment postuler",
      bullets: applyBullets,
      footer: buildSourceLine(item),
    });
  }

  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption
  const parts: string[] = [item.title, "", shortenText(item.summary, 300)];
  if (deadlineStr) parts.push("", `Date limite — ${formatDeadline(deadlineStr)}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
