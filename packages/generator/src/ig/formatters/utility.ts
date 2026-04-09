/**
 * IG Formatter – Utility carousel (taux du jour, study guides, career, etc.)
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { buildCaption, buildSourceFooter, buildSourceLine, shortenText, formatDeadline, shortenHeadline, type BilingualText } from "./helpers.js";

/** Background for the EdLight News CTA closing slide — Marché Central, Port-au-Prince. */
const UTILITY_CTA_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/edlight-news.firebasestorage.app/o/ig_assets%2Fcta%2Futility-cta.jpg?alt=media&token=3f4ce456-27ba-4f16-9600-c4672aa7352e";

export function buildUtilityCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;

  // Slide 1: Cover — title only (Bloomberg style, mirrors news)
  slides.push({
    heading: shortenHeadline(title, 14),
    bullets: [],
    layout: "headline",
    ...(item.imageUrl ? { backgroundImage: item.imageUrl } : {}),
  });

  // Slide 2+: Practical info (split across slides if many facts)
  const facts = item.utilityMeta?.extractedFacts;
  const imageUrl = item.imageUrl ?? undefined;
  if (facts) {
    const bullets: string[] = [];
    if (facts.deadlines?.length) {
      for (const d of facts.deadlines.slice(0, 3)) {
        bullets.push(`${d.label}: ${formatDeadline(d.dateISO)}`);
      }
    }
    if (facts.requirements?.length) {
      for (const r of facts.requirements.slice(0, 3)) {
        bullets.push(shortenText(r, 140));
      }
    }
    if (facts.steps?.length) {
      for (const s of facts.steps.slice(0, 3)) {
        bullets.push(shortenText(s, 140));
      }
    }
    if (bullets.length > 0) {
      // Cap at 4 bullets per slide to stay within 925px pixel budget
      if (bullets.length <= 4) {
        slides.push({ heading: "Infos pratiques", bullets, layout: "explanation", ...(imageUrl ? { backgroundImage: imageUrl } : {}) });
      } else {
        slides.push({ heading: "Infos pratiques", bullets: bullets.slice(0, 4), layout: "explanation", ...(imageUrl ? { backgroundImage: imageUrl } : {}) });
        slides.push({ heading: "Autres détails", bullets: bullets.slice(4, 8), layout: "explanation", ...(imageUrl ? { backgroundImage: imageUrl } : {}) });
      }
    }
  }

  // Slide 3: Notes
  if (facts?.notes?.length) {
    slides.push({
      heading: "À retenir",
      bullets: facts.notes.slice(0, 3).map((n) => shortenText(n, 140)),
      layout: "explanation",
      footer: buildSourceFooter(item),
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  if (slides.length > 0 && !slides[slides.length - 1]!.footer) {
    slides[slides.length - 1]!.footer = buildSourceFooter(item);
  }

  // ── Marketing CTA slide ──
  slides.push({
    heading: "Suivez EdLight News",
    bullets: ["Ressources & infos pratiques, chaque semaine."],
    layout: "cta",
    backgroundImage: UTILITY_CTA_IMAGE,
    footer: buildSourceLine(item),
  });

  // Caption — bilingual, standardised formula
  return {
    slides,
    caption: buildCaption({
      title,
      summary,
      htSummary: bi?.htSummary,
      sourceLine: buildSourceLine(item),
      hashtags: "#EdLightNews #Haïti #Ressources",
      summaryCap: 400,
    }),
  };
}
