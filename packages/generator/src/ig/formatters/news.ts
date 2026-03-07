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
import { truncateCaption, buildCTA, buildSourceLine, shortenText, shortenHeadline, type BilingualText } from "./helpers.js";

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
  // Web UI junk that leaks through scraping
  "click to comment", "leave a reply", "leave a comment",
  "in this article", "your email address", "notify me",
  "log in to leave", "save my name", "required fields",
  "read more", "read also", "see also", "related articles",
  "newsletter", "subscribe", "s'abonner", "s'inscrire",
  /^publicité/i, /^pub$/i, /^ad$/i,
  /^tags?\s*:/i, /^catégorie/i, /^filed under/i,
  /l'article .+ est apparu en premier sur/i,
  // HTML / ad tracker remnants
  /zoneid=/i, /insert_random_number/i, /<img\s/i, /<a\s/i, /<\/a>/i,
  /\.js["']/i, /\.php/i, /\.aspx/i,
  "faites défiler", "plus de contenu", "contenu sponsorisé",
  /^\s*src=["']/i, /border=["']?0/i,
  // Sidebar / related article fragments
  /^[A-ZÀ-Ü][a-zà-ü]+ [A-ZÀ-Ü][a-zà-ü]+ (Politique|Économie|Sport|Culture|Société|Diplomatie|Justice)/,
  "diaspora", /^partager$/i,
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

  // ── Slide 1: Hero cover — big bold headline only (Bloomberg style) ──
  // No subtitle bullet — the headline tells the story, CSS clamp handles overflow.
  slides.push({
    heading: shortenHeadline(title),
    bullets: [],
    layout: "headline",
    footer: geoLabel,
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slides 2+: Story beats ──
  // Prefer French-language beats. If extractedText is in English (common for
  // English-language sources like Haitian Times), synthesize beats from the
  // bilingual summary instead to avoid showing raw English fragments.
  const beats = extractFrenchBeats(item, summary);

  for (const beat of beats) {
    slides.push({
      heading: beat,
      bullets: [],  // No sub-bullets — the heading IS the point
      layout: "headline",
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
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

// ── French language detection ──────────────────────────────────────────────

const FRENCH_MARKERS = [
  " le ", " la ", " les ", " des ", " du ", " un ", " une ",
  " est ", " sont ", " dans ", " pour ", " par ", " avec ",
  " sur ", " qui ", " que ", " cette ", " selon ",
  " à ", " au ", " aux ", " été ", " mais ",
];

/**
 * Simple heuristic: count French stop-words. If fewer than 5 hits per 500 chars,
 * the text is likely NOT French (probably English).
 */
function looksLikeFrench(text: string): boolean {
  if (!text || text.length < 50) return false;
  const sample = ` ${text.slice(0, 800).toLowerCase()} `;
  const hits = FRENCH_MARKERS.filter((m) => sample.includes(m)).length;
  return hits >= 5;
}

/** Maximum characters for a single beat line on a headline slide. */
const MAX_BEAT_CHARS = 200;

/**
 * Split text into complete sentences, keeping the ending punctuation.
 * E.g. "Hello world. Next one!" → ["Hello world.", "Next one!"]
 */
function splitSentences(text: string): string[] {
  // Match sentences that end with . ! or ? followed by space/EOL
  const raw = text.match(/[^.!?]*[^.!?\s][^.!?]*[.!?]+/g);
  if (!raw) return [];
  return raw
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0);
}

/**
 * Strip common scraping artifacts from extracted text before parsing:
 * - HTML tags (<a>, <img>, etc.)
 * - Ad tracker URLs and parameters
 * - "PUBLICITÉ — Faites défiler…" blocks
 * - "L'article … est apparu en premier sur …" trailers
 * - "Plus de contenu" sections
 */
function cleanExtractedText(text: string): string {
  return text
    // Strip HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove ad tracker URLs (zoneid=, INSERT_RANDOM, etc.)
    .replace(/https?:\/\/ads\.[^\s]*/gi, "")
    .replace(/zoneid=[^\s]*/gi, "")
    .replace(/INSERT_RANDOM_NUMBER_HERE/gi, "")
    .replace(/['"][^'"]*\.(js|php|aspx)[^'"]*['"]/gi, "")
    // Remove PUBLICITÉ blocks (may span to next sentence)
    .replace(/PUBLICITÉ[^.]*\./gi, "")
    .replace(/[Ff]aites défiler[^.]*\./g, "")
    // Remove "L'article ... est apparu en premier sur ..." trailers
    .replace(/L'article\s+.+?est apparu en premier sur\s+\S+\.?/gi, "")
    // Remove "Plus de contenu" / related article sections and everything after
    .replace(/Plus de contenu.*/gis, "")
    .replace(/Articles? (similaires?|connexes?|associ[eé]s?).*/gis, "")
    .replace(/Sur le même sujet.*/gis, "")
    .replace(/À lire (aussi|également).*/gis, "")
    .replace(/Lire (aussi|la suite).*/gis, "")
    // Clean up multiple spaces / newlines
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * If a beat is too long for a headline slide, find the best way to shorten
 * it while keeping a complete, polished thought:
 *   1. If a complete sub-sentence exists within the limit (last "."), use it.
 *   2. Otherwise truncate at a clause boundary (, ; – —) and end with ".".
 *   3. Last resort: word-boundary truncation with ".".
 * Never produces "…" — every slide ends with a proper period.
 */
function capBeatLength(text: string, max = MAX_BEAT_CHARS): string {
  if (text.length <= max) return text;

  const chunk = text.slice(0, max);

  // Best: find a complete sub-sentence (ends with ".")
  // Skip periods inside decimal numbers like "250.000"
  const periodIdx = chunk.lastIndexOf(".");
  if (periodIdx > max * 0.45 && !/\d$/.test(chunk.slice(periodIdx - 1, periodIdx))) {
    return chunk.slice(0, periodIdx + 1).trim();
  }

  // Good: clause boundary (comma, semicolon, dash)
  const lastBreak = Math.max(
    chunk.lastIndexOf(", "),
    chunk.lastIndexOf("; "),
    chunk.lastIndexOf(" – "),
    chunk.lastIndexOf(" — "),
  );
  if (lastBreak > max * 0.4) {
    return chunk.slice(0, lastBreak).replace(/[,;\s]+$/, "") + ".";
  }

  // Fallback: word-boundary truncation
  const lastSpace = chunk.lastIndexOf(" ");
  if (lastSpace > max * 0.5) {
    return chunk.slice(0, lastSpace).replace(/[,;\s]+$/, "") + ".";
  }
  return chunk.trimEnd() + ".";
}

/**
 * Extract 2-3 story beats in French from the best available source:
 * 1. If extractedText is in French → parse sentences from it
 * 2. Otherwise → split the French summary into meaningful beats
 *
 * Each beat is a complete sentence capped at ~160 chars so it renders
 * cleanly on a headline slide without being visually clipped.
 */
function extractFrenchBeats(item: Item, frSummary: string): string[] {
  // Try extractedText first (most detailed)
  if (item.extractedText && looksLikeFrench(item.extractedText)) {
    const cleaned = cleanExtractedText(item.extractedText);
    const sentences = splitSentences(cleaned)
      .filter((s) => s.length > 30 && s.length < 350)
      .filter((s) => !isJunkSentence(s));

    const picks = pickSpreadBeats(sentences, 3);
    if (picks.length > 0) return picks.map((b) => capBeatLength(b));
  }

  // Fallback: synthesize beats from the French summary
  if (frSummary && frSummary.length > 40) {
    const sentences = splitSentences(frSummary)
      .filter((s) => s.length > 25)
      .filter((s) => !isJunkSentence(s));

    if (sentences.length >= 2) {
      return sentences.slice(0, 3).map((b) => capBeatLength(b));
    }
    // Single long summary → cap it
    if (frSummary.length > 60) {
      return [capBeatLength(frSummary)];
    }
  }

  return [];
}

/**
 * Pick N sentences spread evenly across the text (not all from the beginning).
 * Prefers sentences that are already short enough to avoid truncation.
 * This gives a more balanced story arc with cleaner output.
 */
function pickSpreadBeats(sentences: string[], n: number): string[] {
  if (sentences.length <= n) return sentences;

  // Prefer sentences that won't need truncation
  const short = sentences.filter((s) => s.length <= MAX_BEAT_CHARS);
  const pool = short.length >= n ? short : sentences;

  const step = Math.floor(pool.length / (n + 1));
  const picks: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.min(step * (i + 1), pool.length - 1);
    picks.push(pool[idx]!);
  }
  return picks;
}
