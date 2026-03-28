/**
 * IG Formatter – Opportunity carousel (Bloomberg/Litquidity style)
 *
 * Each slide = one story beat. Self-contained swipe-through.
 * Same structure as scholarship but adapted for general opportunities.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { finalizeCaption, buildCTA, formatDeadline, buildSourceFooter, buildSourceLine, shortenText, humanizeUrl, shortenHeadline, shortenCaptionText, ensureFrenchEligibility, ensureFrenchHowToApply, ensureFrenchOpportunityCopy, type BilingualText } from "./helpers.js";

/** Background for the EdLight News CTA closing slide — Citadelle Laferrière. */
const OPPORTUNITY_CTA_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Citadelle_Laferriere.jpg/1080px-Citadelle_Laferriere.jpg";

export function buildOpportunityCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;
  const title = bi?.frTitle ?? item.title;
  const summary = ensureFrenchOpportunityCopy(
    bi?.frSummary ?? item.summary,
    "Programme à consulter sur le site officiel pour les détails complets.",
  );
  const imageUrl = item.imageUrl ?? undefined;
  const coverage = item.opportunity?.coverage
    ? ensureFrenchOpportunityCopy(item.opportunity.coverage, "")
    : "";
  const geoLabel = item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : item.geoTag ? "International" : "";
  const deadlineLabel = deadlineStr ? `Date limite — ${formatDeadline(deadlineStr)}` : "";

  // ── Slide 1: Hero cover — title + geo/deadline context (mirrors scholarship) ──
  const coverContext = [geoLabel, deadlineLabel].filter(Boolean).join("  ·  ");
  slides.push({
    heading: shortenHeadline(title, 15),
    bullets: coverContext ? [coverContext] : [],
    layout: "headline",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slide 2: About — what is this opportunity ──
  // Include coverage/geo context as first bullet if available
  const aboutBullets: string[] = [];
  const coverMeta: string[] = [];
  if (coverage) coverMeta.push(coverage);
  if (geoLabel) coverMeta.push(geoLabel);
  if (coverMeta.length > 0) aboutBullets.push(coverMeta.join("  ·  "));
  aboutBullets.push(shortenText(summary, 300));
  slides.push({
    heading: "De quoi s'agit-il ?",
    bullets: aboutBullets,
    layout: "explanation",
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slide 3: Eligibility (separate bullets for readability) ──
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

  // ── Slide 4: How to apply (link first, then deadline last) ──
  const applyBullets: string[] = [];
  if (item.opportunity?.officialLink) applyBullets.push(humanizeUrl(item.opportunity.officialLink));
  if (item.opportunity?.howToApply) applyBullets.push(shortenText(ensureFrenchHowToApply(item.opportunity.howToApply), 250));
  if (deadlineStr) applyBullets.push(`Date limite — ${formatDeadline(deadlineStr)}`);
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

  // ── Marketing CTA slide ──
  slides.push({
    heading: "Suivez EdLight News",
    bullets: ["Bourses & opportunités, chaque semaine."],
    layout: "cta",
    backgroundImage: OPPORTUNITY_CTA_IMAGE,
    footer: buildSourceLine(item),
  });

  // ── Caption ──
  const parts: string[] = [title, "", shortenCaptionText(summary, 300)];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenCaptionText(bi.htSummary, 250)}`);
  if (deadlineStr) parts.push("", `Date limite — ${formatDeadline(deadlineStr)}`);
  parts.push("", "#Opportunité #EdLightNews #Haïti #Éducation #Carrière");
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: finalizeCaption(parts.join("\n")) };
}
