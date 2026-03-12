/**
 * IG Formatter – News carousel (Bloomberg/Litquidity style)
 *
 * Each slide = one story beat. The carousel tells the complete story.
 *
 * Section-aware path (preferred — when Gemini sections available):
 *   Slide 1: Hook headline
 *   Slides 2-5: One per Gemini section (heading + body bullets)
 *   Last slide: Source/CTA
 *
 * Legacy beat path (fallback — no sections):
 *   Slide 1: Hook headline
 *   Slides 2-4: Key story beats (deduplicated via Jaccard similarity)
 *   Last slide: Source/CTA
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

/** Max content slides between cover and source (keeps carousels tight). */
const MAX_NEWS_CONTENT_SLIDES = 4;

export function buildNewsCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;
  const geoLabel = item.geoTag === "HT" ? "Haïti" : item.geoTag === "Diaspora" ? "Diaspora" : "International";
  const imageUrl = item.imageUrl ?? undefined;

  // ── Slide 1: Hero cover — big bold headline only (Bloomberg style) ──
  slides.push({
    heading: shortenHeadline(title),
    bullets: [],
    layout: "headline",
    footer: geoLabel,
    ...(imageUrl ? { backgroundImage: imageUrl } : {}),
  });

  // ── Slides 2+: Story content ──
  // Priority 1: Gemini-structured sections (each section = distinct slide)
  // Priority 2: extractedText sentence beats (with dedup)
  // Priority 3: summary sentence beats
  const usedSections = buildSectionSlides(slides, bi, imageUrl);

  if (!usedSections) {
    // Fallback: parse beats from extractedText / summary
    const beats = extractFrenchBeats(item, summary);
    for (const beat of beats) {
      slides.push({
        heading: beat,
        bullets: [],
        layout: "headline",
        ...(imageUrl ? { backgroundImage: imageUrl } : {}),
      });
    }
  }

  // ── Last slide: source attribution ──
  if (slides.length > 0) {
    slides[slides.length - 1]!.footer = buildSourceLine(item);
  }

  // ── Caption — bilingual with section highlights when available ──
  const parts: string[] = [title, "", shortenText(summary, 400)];
  if (usedSections && bi?.frSections) {
    parts.push("");
    for (const sec of bi.frSections.slice(0, MAX_NEWS_CONTENT_SLIDES)) {
      const firstSentence = splitSentences(sec.content)[0];
      if (firstSentence) parts.push(`📌 ${sec.heading}: ${shortenText(firstSentence, 120)}`);
    }
  }
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenText(bi.htSummary, 300)}`);
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: truncateCaption(parts.join("\n")) };
}

/**
 * Build content slides from Gemini-structured sections.
 * Each section becomes its own slide with heading + body bullets.
 * Returns true if sections were used, false to fall back to beats.
 */
function buildSectionSlides(
  slides: IGSlide[],
  bi: BilingualText | undefined,
  imageUrl: string | undefined,
): boolean {
  if (!bi?.frSections || bi.frSections.length === 0) return false;

  const sections = bi.frSections.slice(0, MAX_NEWS_CONTENT_SLIDES);

  for (const sec of sections) {
    // Split section content into readable bullets
    const bullets = sectionToBullets(sec.content);
    slides.push({
      heading: sec.heading,
      bullets,
      layout: "headline",
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }
  return true;
}

/** Max bullets per section slide. */
const NEWS_MAX_BULLETS = 3;
/** Max chars per bullet. */
const NEWS_MAX_BULLET_CHARS = 180;

/** Split section content into digestible bullets for a news slide. */
function sectionToBullets(content: string): string[] {
  // Try paragraph split
  let parts = content.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 10);
  // If one big paragraph, split by sentences
  if (parts.length <= 1) {
    parts = splitSentences(content).filter((s) => s.length >= 15 && !isJunkSentence(s));
  }
  return parts
    .slice(0, NEWS_MAX_BULLETS)
    .map((b) => b.length > NEWS_MAX_BULLET_CHARS ? capBeatLength(b, NEWS_MAX_BULLET_CHARS) : b);
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
export function splitSentences(text: string): string[] {
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
export function cleanExtractedText(text: string): string {
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
      return dedupBeats(sentences.slice(0, 4)).slice(0, 3).map((b) => capBeatLength(b));
    }
    // Single long summary → cap it
    if (frSummary.length > 60) {
      return [capBeatLength(frSummary)];
    }
  }

  return [];
}

// ── Similarity helpers ──────────────────────────────────────────────────────

/** French stop-words to ignore when computing similarity. */
const STOP_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "en",
  "est", "sont", "dans", "pour", "par", "avec", "sur", "qui", "que",
  "ce", "cette", "au", "aux", "se", "ne", "pas", "a", "à", "été",
  "il", "elle", "ils", "ont", "son", "sa", "ses", "leurs", "leur",
  "mais", "ou", "où", "aussi", "plus", "très", "tout", "tous",
  "the", "of", "and", "to", "in", "is", "for", "that", "on", "was",
]);

/** Extract meaningful content words (lowercase, no stop-words, no short words). */
function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/);
  return new Set(words.filter((w) => w.length > 2 && !STOP_WORDS.has(w)));
}

/** Jaccard similarity between two texts' content words (0 = unrelated, 1 = identical). */
function jaccardSimilarity(a: string, b: string): number {
  const setA = contentWords(a);
  const setB = contentWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) { if (setB.has(w)) intersection++; }
  return intersection / (setA.size + setB.size - intersection);
}

/** Threshold above which two sentences are considered "saying the same thing". */
const SIMILARITY_THRESHOLD = 0.40;

/**
 * Pick N sentences spread evenly across the text, skipping any that are
 * too similar (Jaccard > 0.40) to an already-picked beat.
 * Prefers sentences short enough to avoid truncation.
 */
function pickSpreadBeats(sentences: string[], n: number): string[] {
  if (sentences.length <= n) {
    // Even when taking all, dedup adjacent near-duplicates
    return dedupBeats(sentences);
  }

  // Prefer sentences that won't need truncation
  const short = sentences.filter((s) => s.length <= MAX_BEAT_CHARS);
  const pool = short.length >= n ? short : sentences;

  const step = Math.floor(pool.length / (n + 1));
  const picks: string[] = [];

  // Start from spread positions but allow sliding forward to skip dupes
  for (let i = 0; i < n && picks.length < n; i++) {
    const startIdx = Math.min(step * (i + 1), pool.length - 1);
    // Try the ideal position first, then scan forward for a non-duplicate
    let found = false;
    for (let j = startIdx; j < pool.length && !found; j++) {
      const candidate = pool[j]!;
      const tooSimilar = picks.some((p) => jaccardSimilarity(p, candidate) > SIMILARITY_THRESHOLD);
      if (!tooSimilar) {
        picks.push(candidate);
        found = true;
      }
    }
    // If nothing forward worked, scan backward from startIdx
    if (!found) {
      for (let j = startIdx - 1; j >= 0 && !found; j--) {
        const candidate = pool[j]!;
        const tooSimilar = picks.some((p) => jaccardSimilarity(p, candidate) > SIMILARITY_THRESHOLD);
        if (!tooSimilar) {
          picks.push(candidate);
          found = true;
        }
      }
    }
  }
  return picks;
}

/** Remove near-duplicate sentences from a small array. */
function dedupBeats(beats: string[]): string[] {
  const result: string[] = [];
  for (const b of beats) {
    if (!result.some((r) => jaccardSimilarity(r, b) > SIMILARITY_THRESHOLD)) {
      result.push(b);
    }
  }
  return result;
}
