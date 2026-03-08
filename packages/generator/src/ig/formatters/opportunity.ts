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

  // ── Slide 1: Hero cover (generous headline limit to avoid 3-dots) ──
  const coverSub: string[] = [];
  if (item.opportunity?.coverage) coverSub.push(item.opportunity.coverage);
  if (item.geoTag) {
    coverSub.push(item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International");
  }
  slides.push({
    heading: shortenHeadline(title, 20),
    bullets: coverSub.length > 0 ? [coverSub.join("  ·  ")] : [],
    layout: "headline",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slide 2: About — what is this opportunity ──
  slides.push({
    heading: "De quoi s'agit-il ?",
    bullets: [shortenText(summary, 350)],
    layout: "explanation",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slide 3: Eligibility (separate bullets for readability) ──
  if (item.opportunity?.eligibility?.length) {
    const elig = item.opportunity.eligibility;
    if (elig.length <= 5) {
      slides.push({
        heading: "Qui peut postuler ?",
        bullets: elig.map((e) => `✓ ${e}`),
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    } else {
      slides.push({
        heading: "Qui peut postuler ?",
        bullets: elig.slice(0, 4).map((e) => `✓ ${e}`),
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
      slides.push({
        heading: "Autres critères",
        bullets: elig.slice(4, 8).map((e) => `✓ ${e}`),
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    }
  }

  // ── Slide 4: How to apply (link first, then deadline last) ──
  const applyBullets: string[] = [];
  if (item.opportunity?.officialLink) applyBullets.push(`🔗 ${humanizeUrl(item.opportunity.officialLink)}`);
  if (item.opportunity?.howToApply) applyBullets.push(`📝 ${item.opportunity.howToApply}`);
  if (deadlineStr) applyBullets.push(`📅 Date limite: ${formatDeadline(deadlineStr)}`);
  if (applyBullets.length === 0) applyBullets.push("Voir le lien dans la bio pour postuler");

  slides.push({
    heading: "Comment postuler",
    bullets: applyBullets,
    layout: "explanation",
    footer: buildSourceLine(item),
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

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
