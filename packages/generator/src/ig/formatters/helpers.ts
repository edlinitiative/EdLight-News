/**
 * IG Formatter helpers — shared across all formatter templates.
 */

import type { Item } from "@edlight-news/types";

const MAX_CAPTION_LENGTH = 2200; // IG's actual limit
const MIN_CAPTION_LENGTH = 600;

const CAPTION_STOP_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "en",
  "est", "sont", "dans", "pour", "par", "avec", "sur", "qui", "que",
  "ce", "cette", "au", "aux", "se", "ne", "pas", "a", "à", "été",
  "il", "elle", "ils", "ont", "son", "sa", "ses", "leurs", "leur",
  "mais", "ou", "où", "aussi", "plus", "très", "tout", "tous",
  "the", "of", "and", "to", "in", "is", "for", "that", "on", "was",
]);

const SENTENCE_BOUNDARY_RE = /[.!?](?=\s|$)/g;

// ── English-detection for eligibility/howToApply safety net ─────────────────

/** Common English function words that rarely appear in French. */
const EN_MARKERS = [
  /\bmust be\b/i, /\bshould be\b/i, /\bapplicants?\b/i,
  /\brequired\b/i, /\bsubmit\b/i, /\byou must\b/i,
  /\beligible\b/i, /\bcitizens? of\b/i, /\bnationals? of\b/i,
  /\bapply online\b/i, /\bapplication form\b/i,
  /\bundergradiate\b/i, /\bundergraduate\b/i, /\bgraduate\b/i,
  /\bscholarship\b/i, /\bfunding\b/i, /\bfellowship\b/i,
  /\bthe applicant\b/i, /\bopen to\b/i, /\bmust have\b/i,
  /\bdeveloping countr/i, /\ball nationalities\b/i,
];

/**
 * Returns true when the text is likely English rather than French.
 * Uses a lightweight marker approach — no heavy NLP needed.
 */
export function looksEnglish(text: string): boolean {
  if (!text || text.length < 10) return false;
  let hits = 0;
  for (const re of EN_MARKERS) {
    if (re.test(text)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/**
 * Filter an eligibility array: drop bullets that are clearly English
 * and replace with a single French fallback if all are English.
 * Uses a stricter single-marker check per bullet (not the 2-hit looksEnglish
 * threshold) because individual short eligibility bullets may only hit 1 marker.
 */
export function ensureFrenchEligibility(bullets: string[]): string[] {
  return bullets
    .map((bullet) => translateOpportunityText(bullet))
    .filter((bullet) => bullet.length > 0);
}

/** Stricter English detection for short text: 1 marker hit = English. */
function looksEnglishStrict(text: string): boolean {
  if (!text || text.length < 10) return false;
  return EN_MARKERS.some((re) => re.test(text));
}

/**
 * Return a French howToApply string; if the input is English, replace
 * with a generic French instruction.
 */
export function ensureFrenchHowToApply(text: string): string {
  const translated = translateOpportunityText(text);
  if (looksEnglishStrict(translated)) {
    return `${translated} — voir le site officiel pour les détails.`;
  }
  return translated;
}

const OPPORTUNITY_TRANSLATION_RULES: Array<[RegExp, string]> = [
  [/\bapplicants?\b/gi, "candidats"],
  [/\bapplication form\b/gi, "formulaire de candidature"],
  [/\bapply online\b/gi, "postulez en ligne"],
  [/\bapply via\b/gi, "postulez via"],
  [/\bapply through\b/gi, "postulez via"],
  [/\bapply\b/gi, "postuler"],
  [/\beligible\b/gi, "éligible"],
  [/\beligibility\b/gi, "éligibilité"],
  [/\bcitizens? of\b/gi, "ressortissants de"],
  [/\bnationals? of\b/gi, "ressortissants de"],
  [/\ball nationalities\b/gi, "toutes nationalités"],
  [/\bopen to\b/gi, "ouvert à"],
  [/\bmust be\b/gi, "doit être"],
  [/\byou must\b/gi, "vous devez"],
  [/\bmust have\b/gi, "doit avoir"],
  [/\brequired\b/gi, "obligatoire"],
  [/\brequirements?\b/gi, "critères"],
  [/\bsubmit\b/gi, "soumettre"],
  [/\bscholarship\b/gi, "bourse"],
  [/\bfellowship\b/gi, "programme"],
  [/\bfunding\b/gi, "financement"],
  [/\bundergraduate\b/gi, "licence"],
  [/\bgraduate\b/gi, "master"],
  [/\bpostgraduate\b/gi, "cycle supérieur"],
  [/\bdeadline\b/gi, "date limite"],
  [/\bfor more information\b/gi, "pour plus d'informations"],
  [/\bplease note\b/gi, "à noter"],
  [/\bin order to\b/gi, "pour"],
  [/\btuition fees\b/gi, "frais de scolarité"],
  [/\bfull tuition\b/gi, "frais de scolarité complets"],
  [/\bliving expenses\b/gi, "frais de vie"],
  [/\bmonthly stipend\b/gi, "allocation mensuelle"],
  [/\btravel costs\b/gi, "frais de voyage"],
  [/\bhealth insurance\b/gi, "assurance santé"],
];

export function translateOpportunityText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  let translated = trimmed;
  for (const [pattern, replacement] of OPPORTUNITY_TRANSLATION_RULES) {
    translated = translated.replace(pattern, replacement);
  }

  translated = translated
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (_m, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
    .trim();

  return translated;
}

/**
 * Bilingual text overrides from content_versions (fr + ht).
 * When provided, formatters use these instead of raw item.title/summary.
 */
export interface BilingualText {
  frTitle: string;
  frSummary: string;
  htTitle?: string;
  htSummary?: string;
  /** Structured body sections from FR content_version (richer IG slides) */
  frSections?: { heading: string; content: string }[];
  /** Full body text from FR content_version (fallback for sentence extraction) */
  frBody?: string;
}

/**
 * Format an ISO deadline string to a human-readable French date.
 */
export function formatDeadline(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Truncate caption to MAX_CAPTION_LENGTH while keeping it meaningful.
 */
export function truncateCaption(caption: string): string {
  if (caption.length <= MAX_CAPTION_LENGTH) return caption;

  return trimToCompleteThought(caption, MAX_CAPTION_LENGTH);
}

/**
 * Shorten caption prose while preserving a complete thought.
 */
export function shortenCaptionText(text: string, max: number): string {
  const cleaned = normalizeCaptionWhitespace(text);
  if (!cleaned) return "";
  return trimToCompleteThought(cleaned, max);
}

/**
 * Final cleanup pass for generated captions:
 * - normalizes whitespace
 * - removes repeated content blocks
 * - repairs broken endings
 * - truncates at a complete thought
 */
export function finalizeCaption(caption: string): string {
  const rawBlocks = normalizeCaptionWhitespace(caption)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const keptBlocks: string[] = [];
  const proseBlocks: string[] = [];

  for (const rawBlock of rawBlocks) {
    const block = rawBlock
      .split("\n")
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!block) continue;

    if (isCaptionMetaBlock(block)) {
      keptBlocks.push(block);
      continue;
    }

    const repaired = repairCaptionBlock(block);
    if (!repaired) continue;

    const duplicate = proseBlocks.some((prev) => areCaptionBlocksSimilar(prev, repaired));
    if (duplicate) continue;

    proseBlocks.push(repaired);
    keptBlocks.push(repaired);
  }

  return truncateCaption(keptBlocks.join("\n\n"));
}

/**
 * Detect obvious caption issues that warrant a reviewer pass.
 */
export function hasCaptionQualityIssues(caption: string): boolean {
  const blocks = normalizeCaptionWhitespace(caption)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const proseBlocks: string[] = [];
  for (const block of blocks) {
    if (isCaptionMetaBlock(block)) continue;
    if (looksLikeBrokenCaptionBlock(block)) return true;
    if (proseBlocks.some((prev) => areCaptionBlocksSimilar(prev, block))) return true;
    proseBlocks.push(block);
  }

  return false;
}

/**
 * Pad a short caption with hashtags to meet minimum length.
 */
export function padCaption(caption: string): string {
  if (caption.length >= MIN_CAPTION_LENGTH) return caption;
  const tags = "\n\n#EdLightNews #Haiti #Éducation #Bourse #Opportunité";
  return caption + tags;
}

/**
 * Build the standard bilingual CTA line (French + Kreyòl).
 */
export function buildCTA(): string {
  return "→ Détails sur EdLight News — lien dans la bio\n→ Detay sou EdLight News — lyen nan biyo";
}

/**
 * Build source attribution line from an Item.
 */
export function buildSourceFooter(item: Item): string {
  const sourceName = item.source?.name ?? item.citations?.[0]?.sourceName ?? "Source";
  return `Source: ${sourceName}`;
}

export function buildSourceLine(item: Item): string {
  const sourceName = item.source?.name ?? item.citations?.[0]?.sourceName ?? "Source";
  const sourceUrl = item.source?.originalUrl ?? item.citations?.[0]?.sourceUrl ?? item.canonicalUrl;
  try {
    const domain = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return `Source: ${sourceName} — ${domain}`;
  } catch {
    return `Source: ${sourceName}`;
  }
}

/**
 * Shorten text to a maximum character length, breaking at word boundary.
 */
export function shortenText(text: string, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/**
 * Shorten a headline to at most `maxWords` words AND `maxChars` characters.
 * At 88px hero font with CSS clamp 7, ~130 chars fit comfortably.
 * Prefers cutting at clause boundaries (comma, semicolon, colon, dash) to
 * avoid mid-phrase "…" that looks incomplete.
 */
export function shortenHeadline(text: string, maxWords = 18, maxChars = 130): string {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);

  // Word limit first
  let result = words.length <= maxWords ? trimmed : words.slice(0, maxWords).join(" ");
  const wordTruncated = words.length > maxWords;

  // Then character limit — prefer clause boundary over mid-word cut
  if (result.length > maxChars) {
    const cut = result.slice(0, maxChars);
    // Try clause boundary (comma, semicolon, colon, dash)
    const clauseBreak = Math.max(
      cut.lastIndexOf(", "),
      cut.lastIndexOf("; "),
      cut.lastIndexOf(": "),
      cut.lastIndexOf(" – "),
      cut.lastIndexOf(" — "),
    );
    if (clauseBreak > maxChars * 0.5) {
      return cut.slice(0, clauseBreak).replace(/[,;:\s]+$/, "");
    }
    const lastSpace = cut.lastIndexOf(" ");
    result = lastSpace > maxChars * 0.4 ? cut.slice(0, lastSpace) : cut.trimEnd();
    return result + "…";
  }

  // If we only word-truncated and it fits in maxChars, try to end cleanly
  if (wordTruncated) {
    // Try to end at a clause boundary within the result
    const clauseBreak = Math.max(
      result.lastIndexOf(", "),
      result.lastIndexOf("; "),
      result.lastIndexOf(": "),
      result.lastIndexOf(" – "),
      result.lastIndexOf(" — "),
    );
    if (clauseBreak > result.length * 0.6) {
      return result.slice(0, clauseBreak).replace(/[,;:\s]+$/, "");
    }
    return result + "…";
  }

  return result;
}

// Known news/media domains — "Postulez" doesn't make sense for these
const NEWS_DOMAINS = [
  "juno7.ht", "loophaiti.com", "ayibopost.com", "lenouvelliste.com",
  "haitilibre.com", "alterpresse.org", "metropolehaiti.com",
  "radiotelevisioncaraibes.com", "vfrancaise.com", "maghaiti.net",
  "bbc.com", "reuters.com", "france24.com", "rfi.fr", "lemonde.fr",
  "nytimes.com", "theguardian.com", "aljazeera.com", "cnn.com",
  "apnews.com", "voanews.com",
];

/**
 * Convert a raw URL into human-friendly text for IG slides.
 * e.g. "https://www.campusfrance.org/apply" → "Postulez sur campusfrance.org"
 * For news sites → "Plus d'infos sur juno7.ht"
 */
export function humanizeUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const isNews = NEWS_DOMAINS.some((nd) => domain === nd || domain.endsWith("." + nd));
    return isNews
      ? `Plus d'infos sur ${domain}`
      : `Postulez sur ${domain}`;
  } catch {
    return "Voir le lien dans la bio";
  }
}

function normalizeCaptionWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isCaptionMetaBlock(block: string): boolean {
  const trimmed = block.trim();
  return /^#/.test(trimmed)
    || /^source:/i.test(trimmed)
    || /lien dans la bio|lyen nan biyo/i.test(trimmed)
    || /https?:\/\//i.test(trimmed);
}

function looksLikeBrokenCaptionBlock(block: string): boolean {
  if (isCaptionMetaBlock(block)) return false;
  const trimmed = block.trim();
  if (!trimmed) return false;
  if (/…$/.test(trimmed)) return true;
  if (/[,:;–—-]$/.test(trimmed)) return true;
  return !/[.!?](?:["')\]]+)?$/u.test(trimmed);
}

function repairCaptionBlock(block: string): string {
  const trimmed = normalizeCaptionWhitespace(block);
  if (!trimmed) return "";
  if (isCaptionMetaBlock(trimmed)) return trimmed;
  if (!looksLikeBrokenCaptionBlock(trimmed)) return trimmed;

  const withoutEllipsis = trimmed.replace(/…+$/u, "").trim();
  const lastBoundary = findLastSentenceBoundary(withoutEllipsis);
  if (lastBoundary > withoutEllipsis.length * 0.45) {
    return withoutEllipsis.slice(0, lastBoundary + 1).trim();
  }

  return withoutEllipsis.replace(/[,:;–—\-\s]+$/u, "").trim() + ".";
}

function trimToCompleteThought(text: string, max: number): string {
  const cleaned = normalizeCaptionWhitespace(text);
  if (cleaned.length <= max) return repairCaptionBlock(cleaned);

  const chunk = cleaned.slice(0, max);
  const lastSentenceBoundary = findLastSentenceBoundary(chunk);
  if (lastSentenceBoundary > max * 0.45) {
    return chunk.slice(0, lastSentenceBoundary + 1).trim();
  }

  const lastClauseBoundary = Math.max(
    chunk.lastIndexOf(", "),
    chunk.lastIndexOf("; "),
    chunk.lastIndexOf(": "),
    chunk.lastIndexOf(" – "),
    chunk.lastIndexOf(" — "),
  );
  if (lastClauseBoundary > max * 0.4) {
    return chunk.slice(0, lastClauseBoundary).replace(/[,:;–—\-\s]+$/u, "").trim() + ".";
  }

  const lastSpace = chunk.lastIndexOf(" ");
  const fallback = (lastSpace > max * 0.5 ? chunk.slice(0, lastSpace) : chunk)
    .replace(/[,:;–—\-\s]+$/u, "")
    .trim();

  return fallback + ".";
}

function findLastSentenceBoundary(text: string): number {
  let last = -1;
  for (const match of text.matchAll(SENTENCE_BOUNDARY_RE)) {
    last = match.index ?? last;
  }
  return last;
}

function areCaptionBlocksSimilar(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length >= 30 && longer.includes(shorter)) return true;

  return captionBlockSimilarity(left, right) >= 0.72;
}

function captionBlockSimilarity(a: string, b: string): number {
  const setA = captionContentWords(a);
  const setB = captionContentWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  return intersection / (setA.size + setB.size - intersection);
}

function captionContentWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !CAPTION_STOP_WORDS.has(word));
  return new Set(words);
}
