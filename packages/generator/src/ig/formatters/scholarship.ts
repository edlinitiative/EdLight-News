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
import { buildCaption, formatDeadline, buildSourceFooter, buildSourceLine, humanizeUrl, shortenText, shortenHeadline, ensureFrenchEligibility, ensureFrenchHowToApply, ensureFrenchOpportunityCopy, type BilingualText } from "./helpers.js";
import { narrativeToSlides } from "./news.js";

/** Returns true only if the URL points to a real application page — not a Google News RSS wrapper or news article. */
function isUsableApplyLink(url: string | undefined): boolean {
  if (!url || url.trim().length < 10) return false;
  try {
    const hostname = new URL(url).hostname;
    // Google News RSS wrappers are redirect stubs, not apply pages
    if (hostname === "news.google.com") return false;
    return true;
  } catch { return false; }
}

/** Background for the EdLight News CTA closing slide — Musée du Panthéon National Haïtien (MUPANAH). */
const SCHOLARSHIP_CTA_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/edlight-news.firebasestorage.app/o/ig_assets%2Fcta%2Fscholarship-cta.jpg?alt=media&token=502cfb2a-ab80-4214-a8f5-fb8b7893a5ed";

export function buildScholarshipCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const deadlineStr = item.deadline ?? item.opportunity?.deadline;
  const title = bi?.frTitle ?? item.title;
  const summary = ensureFrenchOpportunityCopy(
    bi?.frSummary ?? item.summary,
    "Programme de bourse à consulter sur le site officiel pour les détails complets.",
  );
  const imageUrl = item.imageUrl ?? undefined;
  const coverage = item.opportunity?.coverage
    ? ensureFrenchOpportunityCopy(
        item.opportunity.coverage,
        "Financement disponible selon le programme",
      )
    : "";
  const deadlineLabel = deadlineStr
    ? `Date limite — ${formatDeadline(deadlineStr)}`
    : "";

  // ── Slide 1: Hero cover (generous headline limit to avoid 3-dots) ──
  const coverSub: string[] = [];
  if (coverage) coverSub.push(`Couverture — ${coverage}`);
  const coverContext = [deadlineLabel].filter(Boolean).join("  ·  ");
  if (coverContext) coverSub.push(coverContext);
  slides.push({
    heading: shortenHeadline(title, 14),
    bullets: coverSub,
    layout: "headline",
    // No backgroundImage — bourses use the branded dark gradient, not a scraped article photo
  });

  // ── Slides 2..N: Narrative-first, structured fallback ────────────────────
  const frNarrative = (bi as any)?.frNarrative as string | undefined;
  if (frNarrative && frNarrative.trim().length > 30) {
    // LLM wrote grouped narrative — most informative path (no website image passed)
    slides.push(...narrativeToSlides(frNarrative, undefined));
  } else {
    // Fallback: structured data slides
    slides.push({
      heading: "De quoi s'agit-il ?",
      bullets: [shortenText(summary, 200)],
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
  // With CTA the total stays at 4-5 — aligned with the template.
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
      heading: "Candidature",
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
    backgroundImage: SCHOLARSHIP_CTA_IMAGE,
    footer: buildSourceLine(item),
  });

  // ── Caption ──
  const extras: string[] = [];
  if (deadlineStr) extras.push(`Date limite — ${formatDeadline(deadlineStr)}`);
  if (coverage) extras.push(`Couverture — ${coverage}`);

  return {
    slides,
    caption: buildCaption({
      title,
      summary,
      htSummary: bi?.htSummary,
      sourceLine: buildSourceLine(item),
      extras,
      hashtags: "#Bourse #BoursesEtudes #EdLightNews #Haïti #Éducation",
      summaryCap: 340,
    }),
  };
}
