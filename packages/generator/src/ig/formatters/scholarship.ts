/**
 * IG Formatter – Scholarship carousel
 *
 * Builds structured slides + caption from normalized Item fields.
 * Never invents facts — only uses existing content fields.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, formatDeadline, buildSourceLine, humanizeUrl, type BilingualText } from "./helpers.js";

export function buildScholarshipCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;

  // Slide 1: Cover
  const meta: string[] = [];
  if (item.opportunity?.coverage) meta.push(item.opportunity.coverage);
  if (deadlineStr) meta.push(`Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.geoTag) {
    meta.push(item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International");
  }
  slides.push({
    heading: title.length > 80 ? title.slice(0, 77) + "…" : title,
    bullets: meta.length > 0 ? meta : ["Bourse disponible"],
    ...(item.imageUrl ? { backgroundImage: item.imageUrl } : {}),
  });

  // Slide 2: Eligibility
  if (item.opportunity?.eligibility?.length) {
    slides.push({
      heading: "Conditions d'éligibilité",
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

  // Caption — bilingual
  const parts: string[] = [title, "", summary];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${bi.htSummary}`);
  if (deadlineStr) parts.push("", `Date limite — ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.coverage) parts.push(`Couverture — ${item.opportunity.coverage}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
