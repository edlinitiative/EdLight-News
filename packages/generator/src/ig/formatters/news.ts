/**
 * IG Formatter – News carousel
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText, type BilingualText } from "./helpers.js";

// Patterns that indicate a sentence is scraping junk, not real content
const JUNK_BULLET_PATTERNS: (string | RegExp)[] = [
  // Email / form prompts
  "prévenez-moi",
  "enregistrer mon nom",
  "adresse e-mail",
  "laisser un commentaire",
  "annuler la réponse",
  "champs obligatoires",
  // Cookie / consent
  "accepter gérer",
  "cookies",
  "gérer mes choix",
  // Ad-blocker / embed warnings
  "extension de votre navigateur",
  "bloquer le chargement",
  "désactiver ou la désinstaller",
  "autoriser les cookies",
  "mesure d'audience",
  // Metadata fragments
  "mots-clés associés",
  "articles similaires",
  "partager cet article",
  "partager sur",
  "copier le lien",
  "imprimer cet article",
  "télécharger en pdf",
  // Related content prompts
  /^à lire aussi/i,
  /^à voir aussi/i,
  /^lire aussi/i,
  /^sur le même sujet/i,
  // Photo credits
  /^©\s/,
  // Timestamps
  /\d+\s*heures?\s*ago/,
  // URLs as sentences
  /^https?:\/\//,
  // Navigation fragments
  "page précédente",
  "page suivante",
  "retour à l'accueil",
];

export function isJunkSentence(sentence: string): boolean {
  const lower = sentence.toLowerCase().trim();
  if (lower.length < 15) return true; // Too short to be meaningful
  return JUNK_BULLET_PATTERNS.some((p) =>
    typeof p === "string" ? lower.includes(p) : p.test(lower),
  );
}

export function buildNewsCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;

  // Geo label for footer display
  const geoLabel = item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International";

  // Slide 1: Cover — summary only (geo tag moved to footer)
  slides.push({
    heading: shortenText(title, 80),
    bullets: [shortenText(summary, 180)],
    footer: geoLabel,
    ...(item.imageUrl ? { backgroundImage: item.imageUrl } : {}),
  });

  // Slide 2: Key points — from extractedText with quality filtering
  if (item.extractedText) {
    const keyPoints = item.extractedText
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 120)
      .filter((s) => !isJunkSentence(s))
      .slice(0, 4);

    if (keyPoints.length >= 2) {
      slides.push({ heading: "Points clés", bullets: keyPoints });
    }
  }

  // Source attribution on last slide
  if (slides.length > 0) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // Caption — bilingual (French primary, Kreyòl secondary)
  const parts: string[] = [
    title,
    "",
    shortenText(summary, 400),
  ];
  if (bi?.htSummary) {
    parts.push("", `🇭🇹 ${shortenText(bi.htSummary, 300)}`);
  }
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}
