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
import { finalizeCaption, buildCTA, buildSourceFooter, buildSourceLine, shortenText, shortenHeadline, shortenCaptionText, looksEnglish, type BilingualText } from "./helpers.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sbd = require("sbd") as { sentences(text: string, opts?: Record<string, unknown>): string[] };

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
  // Blog comment form junk
  /commentaire.*nom.*e-mail/i, /\* nom \*/i, /\* e-mail/i,
  /laisser un commentaire/i, /votre commentaire/i,
  /enregistrer mon nom/i, /mon prochain commentaire/i,
  /site web.*prochain/i,
  // Publication metadata that leaks through scraping (RFI, Mediapart, etc.)
  /^publié le\s*[:\-]/i, /^modifié le\s*[:\-]/i,
  "temps de lecture",
  /^\d+\s*min\s*(temps|de)/i,
  /^\d+\/\d+\/\d{4}\s*[\-–]/,  // date stamps like "28/03/2026 -"
];

export function isJunkSentence(sentence: string): boolean {
  const lower = sentence.toLowerCase().trim();
  if (lower.length < 15) return true;
  return JUNK_BULLET_PATTERNS.some((p) =>
    typeof p === "string" ? lower.includes(p) : p.test(lower),
  );
}

/** Background for the EdLight News CTA closing slide — Citadelle Laferrière. */
const NEWS_CTA_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Citadelle_Laferriere.jpg/1080px-Citadelle_Laferriere.jpg";

/** Max content slides between cover and source (keeps carousels tight). */
const MAX_NEWS_CONTENT_SLIDES = 4;

export function buildNewsCarousel(item: Item, bi?: BilingualText): IGFormattedPayload {
  const slides: IGSlide[] = [];

  const title = bi?.frTitle ?? item.title;
  const summary = bi?.frSummary ?? item.summary;

  // ── English-language gate ──────────────────────────────────────────────
  // Without Gemini content_versions, title/summary/extractedText may be raw
  // English from the source. The LLM reviewer normally catches this, but when
  // the LLM is unavailable we need a static heuristic to prevent English
  // posts going live on a French-language IG account.
  if (!bi?.frTitle) {
    // No bilingual data — check the raw title + leading text for English
    const probe = `${item.title} ${(item.extractedText ?? item.summary ?? "").slice(0, 500)}`;
    if (looksEnglish(probe) && !looksLikeFrench(probe)) {
      return {
        slides: [],
        caption: "",
        _rejected: "English content without French translation",
      } as IGFormattedPayload;
    }
  }

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
  // Priority 1: Narrative-first (4-6 sentence arc split into 2-3 slides)
  // Priority 2: Gemini-structured sections (each section = distinct slide)
  // Priority 3: extractedText sentence beats (with dedup)
  // Priority 4: summary sentence beats
  const usedNarrative = buildNarrativeSlides(slides, bi, imageUrl);

  if (!usedNarrative) {
    const usedSections = buildSectionSlides(slides, bi, imageUrl);

    if (!usedSections) {
      // Fallback: parse beats from extractedText / summary
      // Group into explanation slides for coherent reading
      // (individual headline-only slides read as disconnected facts)
      const beats = extractFrenchBeats(item, summary);
      if (beats.length > 0) {
        slides.push(...narrativeToSlides(beats.join(" "), imageUrl));
      }
    }
  }

  // Keep carousel tight: cover (1) + at most MAX_NEWS_CONTENT_SLIDES content
  const maxBeforeCTA = 1 + MAX_NEWS_CONTENT_SLIDES;
  if (slides.length > maxBeforeCTA) {
    slides.length = maxBeforeCTA;
  }

  // ── Last slide: source attribution ──
  if (slides.length > 0) {
    slides[slides.length - 1]!.footer = buildSourceFooter(item);
  }

  // ── Marketing CTA slide ──
  slides.push({
    heading: "Suivez EdLight News",
    bullets: ["L'actu haïtienne, chaque jour."],
    layout: "cta",
    backgroundImage: NEWS_CTA_IMAGE,
    footer: buildSourceLine(item),
  });

  // ── Caption — bilingual with section highlights when available ──
  const parts: string[] = [title, "", shortenCaptionText(summary, 320)];
  if (!usedNarrative && bi?.frSections) {
    parts.push("");
    for (const sec of bi.frSections.slice(0, MAX_NEWS_CONTENT_SLIDES)) {
      const firstSentence = splitSentences(sec.content)[0];
      if (firstSentence) parts.push(`📌 ${sec.heading}: ${shortenCaptionText(firstSentence, 120)}`);
    }
  }
  if (bi?.htSummary) parts.push("", `🇭🇹 ${shortenCaptionText(bi.htSummary, 300)}`);
  parts.push("", "#ActuHaïti #HaitiNews #EdLightNews");
  parts.push("", buildCTA(), "", buildSourceLine(item));

  return { slides, caption: finalizeCaption(parts.join("\n")) };
}

/**
 * Build content slides from a continuous narrative.
 *
 * Priority:
 *   1. frNarrative — the LLM-written 4-6 sentence arc (best: structured arc)
 *   2. frBody      — the LLM-written full article body (good: coherent, on-topic)
 *   3. returns false → caller falls through to sections/beats
 *
 * Using frBody as a fallback means we almost never hit raw extractedText,
 * which has no narrative structure and pulls from scraped sidebar junk.
 */
function buildNarrativeSlides(
  slides: IGSlide[],
  bi: BilingualText | undefined,
  imageUrl: string | undefined,
): boolean {
  // Path 1: explicit LLM narrative arc
  const narrative = bi?.frNarrative?.trim();
  if (narrative && narrative.length > 0) {
    slides.push(...narrativeToSlides(narrative, imageUrl));
    return true;
  }

  // Path 2: LLM-written article body — take first 6 sentences
  // The body is Gemini-generated: coherent, on-topic, no scraped junk.
  const body = bi?.frBody?.trim();
  if (body && body.length > 100) {
    const sentences = splitSentences(body)
      .filter((s) => s.length > 30 && !isJunkSentence(s))
      .slice(0, 6);
    if (sentences.length >= 2) {
      slides.push(...narrativeToSlides(sentences.join(" "), imageUrl));
      return true;
    }
  }

  return false;
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
      heading: shortenHeadline(sec.heading, 8),
      bullets,
        layout: "explanation",
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
    .map((b) => cleanSlideText(b.length > NEWS_MAX_BULLET_CHARS ? capBeatLength(b, NEWS_MAX_BULLET_CHARS) : b));
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

/** Maximum characters for a beat (used as explanation bullet, not headline). */
const MAX_BEAT_CHARS = 180;

/**
 * Common French abbreviations that should NOT trigger a sentence boundary.
 * sbd already knows English ones (Mr, Mrs, Dr, Jr, etc.);
 * we extend it with French-specific forms.
 */
const FRENCH_ABBREVIATIONS = [
  "M", "Mme", "Mlle", "Mgr", "Dr", "Pr", "Me", "St", "Ste",
  "vol", "vs", "etc", "env", "apr", "av", "cf", "ex", "id",
  "ibid", "loc", "op", "pp", "sq", "art", "chap", "fig",
];

/**
 * Split text into complete sentences using sbd (Sentence Boundary Detection).
 * sbd uses an abbreviation dictionary so it correctly handles M., Dr., etc.
 * rather than splitting on every period.
 */
export function splitSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  return sbd
    .sentences(text, {
      newline_boundaries: false,
      sanitize: false, // we already clean text upstream
      abbreviations: FRENCH_ABBREVIATIONS,
    })
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
    // Strip RFI show/programme names prefixing article content
    .replace(/Journal d'Haïti et des Amériques\s*/gi, "")
    .replace(/Revue de presse des Amériques\s*/gi, "")
    .replace(/Chronique des Amériques\s*/gi, "")
    // Strip publication date/time metadata (RFI, France 24, etc.)
    .replace(/Publié le\s*:?\s*\d+\/\d+\/\d{4}\s*[-–]\s*\d+:\d+\s*/gi, "")
    .replace(/Modifié le\s*:?\s*\d+\/\d+\/\d{4}\s*[-–]\s*\d+:\d+\s*/gi, "")
    .replace(/Écouter l'audio\s*/gi, "")
    .replace(/Écouter\s*[-–]?\s*\d+:\d+\s*/gi, "")
    .replace(/\d+ min(?:utes?)?\s*(?:d'écoute|de lecture)\s*/gi, "")
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
    // Strip editorial brackets: [texte] → texte, orphan ] or [ → nothing
    .replace(/\[([^\[\]]{1,120})\]/g, "$1")
    .replace(/\[\.\.\.[^\]]*\]?/g, "")
    .replace(/\[[^\]]*$/g, "")
    .replace(/[\[\]]/g, "")
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
  const title = item.title;

  // Try extractedText first (most detailed).
  // Use first-N sentences only — spread-based picking tends to pull from
  // related-article sidebar content that scrapers append at the end.
  // Limit to first 2500 chars to prevent roundup articles (RFI, France 24)
  // from mixing content across different sub-stories.
  if (item.extractedText && looksLikeFrench(item.extractedText)) {
    const cleaned = cleanExtractedText(item.extractedText.slice(0, 2500));
    const sentences = splitSentences(cleaned)
      .filter((s) => s.length > 30 && s.length < 350)
      .filter((s) => !isJunkSentence(s));

    // Take from the beginning of the article, dedup, then drop title near-matches
    // Also drop beats that start with the title (common in scraped article text)
    const titleNorm = title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    const picks = dedupBeats(sentences.slice(0, 8)).slice(0, 3)
      .filter((b) => jaccardSimilarity(b, title) <= SIMILARITY_THRESHOLD)
      .filter((b) => !b.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim().startsWith(titleNorm));
    if (picks.length > 0) return picks.map((b) => cleanSlideText(capBeatLength(b)));
  }

  // Fallback: synthesize beats from the French summary
  if (frSummary && frSummary.length > 40) {
    const sentences = splitSentences(frSummary)
      .filter((s) => s.length > 25)
      .filter((s) => !isJunkSentence(s));

    if (sentences.length >= 2) {
      // Dedup among beats AND against the title
      const deduped = dedupBeats(sentences.slice(0, 4))
        .filter((b) => jaccardSimilarity(b, title) <= SIMILARITY_THRESHOLD);
      return deduped.slice(0, 3).map((b) => cleanSlideText(capBeatLength(b)));
    }
    // Single long summary → cap at inner-slide-friendly length (≤ ~4 lines)
    if (frSummary.length > 60) {
      const capped = cleanSlideText(capBeatLength(frSummary, 160));
      // Skip if it just restates the title
      if (jaccardSimilarity(capped, title) <= SIMILARITY_THRESHOLD) {
        return [capped];
      }
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

// ── Narrative formatting ────────────────────────────────────────────────────

/**
 * Split a continuous narrative (4-6 sentences forming one arc) into
 * multiple slides, each containing 2-3 sentences, respecting the ~350-char
 * budget for explanation slides (heading + bullets).
 *
 * Each slide is an "explanation" layout with sentences grouped as bullets.
 * Applies cleanSlideText() to remove parentheses/brackets per aesthetic rules.
 */
export function narrativeToSlides(narrative: string, imageUrl?: string): IGSlide[] {
  const sentences = splitSentences(narrative.trim())
    .filter((s) => s.length > 10)
    .map((s) => cleanSlideText(s));

  if (sentences.length === 0) return [];

  const slides: IGSlide[] = [];
  const SENTENCE_BUDGET = 350; // Target characters per explanation slide
  const MAX_SENTS_PER_SLIDE = 3; // Never more than 3 sentences per slide

  let currentGroup: string[] = [];
  let currentLength = 0;

  for (const sent of sentences) {
    const sentLength = sent.length + 1; // +1 for space between bullets

    // If adding this sentence would exceed budget or hit max count, flush current group
    if (
      currentGroup.length >= MAX_SENTS_PER_SLIDE ||
      (currentGroup.length > 0 && currentLength + sentLength > SENTENCE_BUDGET)
    ) {
      // Push current group as a slide
      if (currentGroup.length > 0) {
        const heading = currentGroup[0]!;
        const bullets = currentGroup.slice(1);
        slides.push({
          heading,
          bullets,
          layout: "explanation",
          ...(imageUrl ? { backgroundImage: imageUrl } : {}),
        });
      }
      currentGroup = [];
      currentLength = 0;
    }

    currentGroup.push(sent);
    currentLength += sentLength;
  }

  // Flush any remaining group
  if (currentGroup.length > 0) {
    const heading = currentGroup[0]!;
    const bullets = currentGroup.slice(1);
    slides.push({
      heading,
      bullets,
      layout: "explanation",
      ...(imageUrl ? { backgroundImage: imageUrl } : {}),
    });
  }

  return slides;
}

/**
 * Clean slide text to meet aesthetic constraints:
 * 1. Rewrite "X (Y)" → "X — Y" (preserve meaning, remove parentheses)
 * 2. Strip "[...]" brackets entirely
 * 3. Remove standalone parenthetical asides (e.g., "(selon la source)")
 * 4. Trim leading/trailing whitespace
 *
 * This post-processor ensures slides look polished without awkward notation.
 */
export function cleanSlideText(text: string): string {
  let result = text.trim();

  // Step 0: Strip orphan guillemets and brackets left at start/end when sbd
  // splits inside French quoted speech (« sentence. » → two beats with «/» stranded)
  result = result.replace(/^[\]»›]+\s*/, "").replace(/\s*[\[«‹]+$/, "").trim();

  // Step 1: Rewrite "X (Y)" → "X — Y"
  // Only rewrites parenthetical notes that add precision, not full sub-thoughts
  // Pattern: "something (detail)" where detail is short (< 50 chars)
  result = result.replace(/([^()])\s*\(([^()]{1,50})\)/g, "$1 — $2");

  // Step 2: Strip "[...]" brackets
  result = result.replace(/\[([^\[\]]*)\]/g, (match, content) => {
    // If it's a source citation like [source], remove it entirely
    // If it has meaningful content, just remove the brackets
    const trimmed = content.trim();
    return trimmed.length > 0 && trimmed.toLowerCase() !== "source" ? trimmed : "";
  });

  // Step 3: Remove standalone parenthetical asides
  // Pattern: sentence that's entirely in parentheses or starts with "(selon..."
  result = result.replace(/\s*\([^()]*\)\s*/g, (match) => {
    const content = match.trim();
    // If it's a pure aside like "(selon la source)", remove entirely
    // Otherwise keep the content without parens
    if (/^\s*\([^()]*selon/.test(content) || /^\s*\([^()]*ndlr/.test(content)) {
      return " ";
    }
    return " ";
  });

  // Step 4: Clean up extra whitespace
  result = result
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.!?,;:])/g, "$1")
    .trim();

  return result;
}
