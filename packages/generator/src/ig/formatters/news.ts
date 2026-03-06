/**
 * IG Formatter – News carousel (Bloomberg/Litquidity style)
 *
 * Each slide = one story beat. The carousel tells the complete story.
 * Slide 1: Hook headline + summary
 * Slides 2-4: Key story beats (one point each, large text)
 * Last slide: Source/CTA
 *
 * Every slide carries a backgroundImage so the renderer can show
 * full-bleed visuals. The igPublishNow pipeline fills missing images
 * via Gemini before rendering.
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import { truncateCaption, buildCTA, buildSourceLine, shortenText, type BilingualText } from "./helpers.js";

// Patterns that indicate a sentence is scraping junk, not real content
const JUNK_BULLET_PATTERNS: (string | RegExp)[] = [
  "prévenez-moi", "enregistrer mon nom", "adresse e-mail",
  "laisser un commentaire", "annuler la réponse", "champs obligatoires",
  "accepter gérer", "cookies", "gérer mes choix",
  "extension de votre navigateur", "bloquer le chargement",
  "désactiver ou la désinstaller", "autoriser les cookies", "mesure d'audience",
  "mots-clés associés", "articles similaires", "partager cet article",
  "partager sur", "copier le lien", "imprimer cet article", "télécharger en pdf",
  /^à lire aussi/i, /^à voir aussi/i, /^lire aussi/i, /^sur le même sujet/i,
  /^©\s/, /\d+\s*heures?\s*ago/, /^https?:\/\//,
  "page précédente", "page suivante", "retour à l'accueil",
];

export function isJunkSentence(sentence: string): boolean {
  const lower = sentence.toLowerCase().trim();
  if (lower.length < 15) return true;
  return JUNK_BULLET_PATTERNS.some((p) =>
    typeof p === "string" ? lower.includes(p) : p.test(lower),
  );
}

export function buildNewsCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;
  const geoLabel = item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International";
  const imageUrl = item.imageUrl ?? undefined;

  // ── Slide 1: Hero cover — headline + short summary ──
  slides.push({
    heading: shortenText(title, 90),
    bullets: [shortenText(summary, 200)],
    footer: geoLabel,
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slides 2+: Story beats from extracted text ──
  // Each beat is ONE key point displayed large on its own slide
  if (item.extractedText) {
    const sentences = item.extractedText
      .split(/[.!?]\s+/)
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter((s) => s.length > 30 && s.length < 200)
      .filter((s) => !isJunkSentence(s));

    // Pick the best 2-3 story beats (spread across the text)
    const beats = pickSpreadBeats(sentences, 3);

    for (const beat of beats) {
      slides.push({
        heading: beat.length > 120 ? shortenText(beat, 120) : beat,
        bullets: [],  // No sub-bullets — the heading IS the point
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    }
  }

  // ── Last slide: source attribution ──
  if (slides.length > 0) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // ── Caption — bilingual (French primary, Kreyòl secondary) ──
  const parts: string[] = [title, "", shortenText(summary, 400)];
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenText(bi.htSummary, 300)}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}

/**
 * Pick N sentences spread evenly across the text (not all from the beginning).
 * This gives a more balanced story arc.
 */
function pickSpreadBeats(sentences: string[], n: number): string[] {
  if (sentences.length <= n) return sentences;
  const step = Math.floor(sentences.length / (n + 1));
  const picks: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.min(step * (i + 1), sentences.length - 1);
    picks.push(sentences[idx]!);
  }
  return picks;
}
