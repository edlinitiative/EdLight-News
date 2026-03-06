/**
 * IG Formatter – Opportunity carousel (Bloomberg/Litquidity style)
 *
 * Each slide = one story beat. Self-contained swipe-through.
 * Same structure as scholarship but adapted for general opportunities.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, formatDeadline, buildSourceLine, shortenText, humanizeUrl, shortenHeadline, type BilingualText } from "./helpers.js";

export function buildOpportunityCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;
  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;
  const imageUrl = item.imageUrl ?? undefined;

  // ── Slide 1: Hero cover ──
  const coverSub: string[] = [];
  if (deadlineStr) coverSub.push(`Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.coverage) coverSub.push(item.opportunity.coverage);
  if (item.geoTag) {
    coverSub.push(item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International");
  }
  slides.push({
    heading: shortenHeadline(title),
    bullets: coverSub.length > 0 ? [coverSub.join("  ·  ")] : [shortenText(summary, 180)],
    layout: "headline",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slide 2: Eligibility ──
  if (item.opportunity?.eligibility?.length) {
    slides.push({
      heading: "Qui peut postuler ?",
      bullets: [item.opportunity.eligibility.slice(0, 3).join(". ")],
      layout: "explanation",
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  // ── Slide 3: How to apply ──
  const applyParts: string[] = [];
  if (deadlineStr) applyParts.push(`Date limite: ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.howToApply) applyParts.push(item.opportunity.howToApply);
  if (item.opportunity?.officialLink) applyParts.push(humanizeUrl(item.opportunity.officialLink));
  if (applyParts.length > 0) {
    slides.push({
      heading: "Comment postuler",
      bullets: [applyParts.join("  ·  ")],
      layout: "explanation",
      footer: buildSourceLine(item),
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  // Ensure last slide has source
  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // ── Caption ──
  const parts: string[] = [title, "", shortenText(summary, 300)];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenText(bi.htSummary, 250)}`);
  if (deadlineStr) parts.push("", `Date limite — ${formatDeadline(deadlineStr)}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
