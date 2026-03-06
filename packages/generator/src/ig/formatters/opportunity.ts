/**
 * IG Formatter – Opportunity carousel
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, formatDeadline, buildSourceLine, shortenText, humanizeUrl, type BilingualText } from "./helpers.js";

export function buildOpportunityCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;

  // Slide 1: Cover
  const meta: string[] = [];
  if (deadlineStr) meta.push(`Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.coverage) meta.push(item.opportunity.coverage);
  if (item.geoTag) {
    meta.push(item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International");
  }
  slides.push({
    heading: shortenText(title, 80),
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

  // Caption — bilingual
  const parts: string[] = [title, "", shortenText(summary, 300)];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenText(bi.htSummary, 250)}`);
  if (deadlineStr) parts.push("", `Date limite — ${formatDeadline(deadlineStr)}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
