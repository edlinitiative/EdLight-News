/**
 * IG Formatter – Scholarship carousel (Bloomberg/Litquidity style)
 *
 * Each slide = one story beat. Self-contained swipe-through.
 * Slide 1: Hook — scholarship name + coverage
 * Slide 2: Eligibility (one bold statement)
 * Slide 3: Deadline + how to apply
 * Slide 4: Source / CTA
 *
 * Every slide carries backgroundImage for full-bleed rendering.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { finalizeCaption, buildCTA, formatDeadline, buildSourceFooter, buildSourceLine, humanizeUrl, shortenText, shortenHeadline, shortenCaptionText, ensureFrenchEligibility, ensureFrenchHowToApply, type BilingualText } from "./helpers.js";

export function buildScholarshipCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
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
    heading: shortenHeadline(title, 15),
    bullets: coverSub.length > 0 ? [coverSub.join("  ·  ")] : [],
    layout: "headline",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slide 2: About — what is this scholarship ──
  slides.push({
    heading: "De quoi s'agit-il ?",
    bullets: [shortenText(summary, 350)],
    layout: "explanation",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slide 3: Eligibility (separate bullets with checkmarks) ──
  if (item.opportunity?.eligibility?.length) {
    const elig = ensureFrenchEligibility(item.opportunity.eligibility)
      .map((b) => shortenText(b, 150));
    if (elig.length <= 4) {
      slides.push({
        heading: "Qui peut postuler ?",
        bullets: elig,
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    } else {
      slides.push({
        heading: "Qui peut postuler ?",
        bullets: elig.slice(0, 4),
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
      slides.push({
        heading: "Autres critères",
        bullets: elig.slice(4, 8),
        layout: "explanation",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    }
  }

  // ── Slide 4: How to apply (link first, then instructions, deadline last) ──
  const applyBullets: string[] = [];
  if (item.opportunity?.officialLink) applyBullets.push(humanizeUrl(item.opportunity.officialLink));
  if (item.opportunity?.howToApply) applyBullets.push(shortenText(ensureFrenchHowToApply(item.opportunity.howToApply), 250));
  if (deadlineStr) applyBullets.push(`Date limite: ${formatDeadline(deadlineStr)}`);
  if (applyBullets.length === 0) applyBullets.push("Voir le lien dans la bio pour postuler");

  slides.push({
    heading: "Comment postuler",
    bullets: applyBullets,
    layout: "explanation",
    footer: buildSourceFooter(item),
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // Ensure last slide has source
  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceFooter(item);
  }

  // ── Caption ──
  const parts: string[] = [title, "", shortenCaptionText(summary, 340)];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenCaptionText(bi.htSummary, 280)}`);
  if (deadlineStr) parts.push("", `Date limite — ${formatDeadline(deadlineStr)}`);
  if (item.opportunity?.coverage) parts.push(`Couverture — ${item.opportunity.coverage}`);
  parts.push("", "#Bourse #BoursesEtudes #EdLightNews #Haïti #Éducation");
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: finalizeCaption(parts.join("\n")) };
}
