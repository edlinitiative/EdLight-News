/**
 * IG Formatter – Opportunity carousel (Bloomberg/Litquidity style)
 *
 * Each slide = one story beat. Self-contained swipe-through.
 * Same structure as scholarship but adapted for general opportunities.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { buildCaption, formatDeadline, buildSourceFooter, buildSourceLine, shortenText, humanizeUrl, shortenHeadline, ensureFrenchEligibility, ensureFrenchHowToApply, ensureFrenchOpportunityCopy, type BilingualText } from "./helpers.js";
import { narrativeToSlides } from "./news.js";

/** Returns true only if the URL points to a real application page — not a Google News RSS wrapper or news article. */
function isUsableApplyLink(url: string | undefined): boolean {
  if (!url || url.trim().length < 10) return false;
  try {
    const hostname = new URL(url).hostname;
    if (hostname === "news.google.com") return false;
    return true;
  } catch { return false; }
}

/** Background for the EdLight News CTA closing slide — view of Port-au-Prince, Haiti. */
const OPPORTUNITY_CTA_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/View_of_Port-au-Prince_from_Hotel_Montana.jpg/1280px-View_of_Port-au-Prince_from_Hotel_Montana.jpg";

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
    heading: shortenHeadline(title, 10),
    bullets: coverContext ? [coverContext] : [],
    layout: "headline",
    // No backgroundImage — opportunities use the branded dark gradient
  });

  // ── Slides 2..N: Narrative-first, structured fallback ────────────────────
  const frNarrative = (bi as any)?.frNarrative as string | undefined;
  if (frNarrative && frNarrative.trim().length > 30) {
    slides.push(...narrativeToSlides(frNarrative, undefined));
  } else {
    // Fallback: structured data — geoLabel intentionally omitted here (already on slide 1)
    const aboutBullets: string[] = [];
    if (coverage) aboutBullets.push(coverage);
    aboutBullets.push(shortenText(summary, 200));
    slides.push({
      heading: "De quoi s'agit-il ?",
      bullets: aboutBullets,
      layout: "explanation",
    });
    if (item.opportunity?.eligibility?.length) {
      const elig = ensureFrenchEligibility(item.opportunity.eligibility)
        .map((b) => shortenText(b, 150));
      slides.push({
        heading: "Qui peut postuler ?",
        bullets: elig.slice(0, 4),
        layout: "explanation",
      });
      if (elig.length > 4) {
        slides.push({
          heading: "Autres critères",
          bullets: elig.slice(4, 8),
          layout: "explanation",
        });
      }
    }
  }

  // ── Cap content slides: MASTER_PROMPT T4 targets 3-4 slides total ──────────
  // cover(1) + max 2 content = 3 slides before the apply slide.
  if (slides.length > 3) slides.length = 3;

  // ── Apply slide: only when there is real actionable data ─────────────────
  const applyBullets: string[] = [];
  if (isUsableApplyLink(item.opportunity?.officialLink))
    applyBullets.push(humanizeUrl(item.opportunity!.officialLink!));
  if (item.opportunity?.howToApply && item.opportunity.howToApply.trim().length > 20)
    applyBullets.push(shortenText(ensureFrenchHowToApply(item.opportunity.howToApply), 250));
  if (deadlineStr)
    applyBullets.push(`Date limite — ${formatDeadline(deadlineStr)}`);

  if (applyBullets.length > 0) {
    slides.push({
      heading: "Comment postuler",
      bullets: applyBullets,
      layout: "explanation",
      footer: buildSourceFooter(item),
    });
  }

  // Ensure last content slide has source
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
  return {
    slides,
    caption: buildCaption({
      title,
      summary,
      htSummary: bi?.htSummary,
      sourceLine: buildSourceLine(item),
      extras: deadlineStr ? [`Date limite — ${formatDeadline(deadlineStr)}`] : [],
      hashtags: "#Opportunité #EdLightNews #Haïti #Éducation #Carrière",
      summaryCap: 300,
    }),
  };
}
