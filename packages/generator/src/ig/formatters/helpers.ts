/**
 * IG Formatter helpers — shared across all formatter templates.
 */

import type { Item, IGFormattedPayload } from "@edlight-news/types";

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
  /\bfull tuition\b/i, /\btuition\b/i, /\bstipend\b/i,
  /\bprofessional experience\b/i, /\bletter of recommendation\b/i,
  /\bcurrent employer\b/i, /\bstatement of purpose\b/i, /\btranscript\b/i,
  /\bwebsite\b/i, /\bportal\b/i, /\bproof of\b/i, /\bresume\b/i,
  /\bcurriculum vitae\b/i, /\bstudents?\b/i,
];

const EN_FUNCTION_WORDS = new Set([
  "the", "and", "for", "with", "from", "your", "their", "this", "that",
  "these", "those", "through", "online", "current", "strong", "leadership",
  "academic", "merit", "students", "student", "application", "details",
]);

const FR_FUNCTION_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "pour", "avec",
  "dans", "sur", "étudiants", "étudiant", "bourse", "programme", "officiel",
  "détails", "candidature", "haïtien", "haïtiens",
]);

function englishFunctionWordScore(text: string): { en: number; fr: number } {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/\b[a-z]{2,}\b/g) ?? [];

  let en = 0;
  let fr = 0;

  for (const word of words) {
    if (EN_FUNCTION_WORDS.has(word)) en++;
    if (FR_FUNCTION_WORDS.has(word)) fr++;
  }

  return { en, fr };
}

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
  const score = englishFunctionWordScore(text);
  return score.en >= 3 && score.en > score.fr;
}

// ── Haitian Creole detection ───────────────────────────────────────────────

/**
 * Distinctive Haitian Creole function words that do NOT appear in French.
 * Used as a negative gate to prevent Creole text from passing the
 * looksLikeFrench() heuristic (French and Creole share many stop-words).
 */
const CREOLE_MARKERS = [
  " nan ", " ak ", " yo ", " yon ", " mwen ", " anpil ",
  " konsa ", " tankou ", " peyi ", " gouvènman ", " moun ",
  " kap ", " gen ", " fè ", " lè ", " pou ", " sou ",
  " pa ", " te ", " sa ",
];

/**
 * Returns true when the text is likely Haitian Creole.
 * Checks for distinctive Creole function words that are absent from French.
 * Threshold: ≥3 marker hits in the first 800 chars.
 */
export function looksLikeCreole(text: string): boolean {
  if (!text || text.length < 50) return false;
  const sample = ` ${text.slice(0, 800).toLowerCase()} `;
  const hits = CREOLE_MARKERS.filter((m) => sample.includes(m)).length;
  return hits >= 3;
}

/**
 * Filter an eligibility array: drop bullets that are clearly English
 * and replace with a single French fallback if all are English.
 * Uses a stricter single-marker check per bullet (not the 2-hit looksEnglish
 * threshold) because individual short eligibility bullets may only hit 1 marker.
 */
export function ensureFrenchEligibility(bullets: string[]): string[] {
  const cleaned = bullets
    .map((bullet) => translateOpportunityText(bullet))
    .filter((bullet) => !looksEnglishStrict(bullet) && !looksEnglish(bullet))
    .filter((bullet) => bullet.length > 0);

  if (cleaned.length > 0) return cleaned;

  return ["Voir les critères officiels sur le site de la bourse."];
}

/** Stricter English detection for short text: 1 marker hit = English. */
function looksEnglishStrict(text: string): boolean {
  if (!text || text.length < 10) return false;
  if (EN_MARKERS.some((re) => re.test(text))) return true;
  const score = englishFunctionWordScore(text);
  return score.en >= 2 && score.en > score.fr;
}

/**
 * Return a French howToApply string; if the input is English, replace
 * with a generic French instruction.
 */
export function ensureFrenchHowToApply(text: string): string {
  const translated = translateOpportunityText(text);
  if (looksEnglishStrict(translated) || looksEnglish(translated)) {
    return "Consultez le site officiel pour connaître les étapes de candidature.";
  }
  return translated;
}

export function ensureFrenchOpportunityCopy(
  text: string,
  fallback: string,
): string {
  const translated = translateOpportunityText(text);
  if (!translated) return fallback;
  if (looksEnglishStrict(translated) || looksEnglish(translated)) {
    return fallback;
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
  [/\bstudents?\b/gi, "étudiants"],
  [/\bpostgraduate\b/gi, "cycle supérieur"],
  [/\bdeadline\b/gi, "date limite"],
  [/\bfor more information\b/gi, "pour plus d'informations"],
  [/\bplease note\b/gi, "à noter"],
  [/\bin order to\b/gi, "pour"],
  [/\bthrough\b/gi, "via"],
  [/\bwebsite\b/gi, "site officiel"],
  [/\bportal\b/gi, "portail"],
  [/\bprofessional experience\b/gi, "expérience professionnelle"],
  [/\bletter of recommendation\b/gi, "lettre de recommandation"],
  [/\bcurrent employer\b/gi, "employeur actuel"],
  [/\bstatement of purpose\b/gi, "lettre de motivation"],
  [/\btranscript\b/gi, "relevé de notes"],
  [/\bproof of\b/gi, "preuve de"],
  [/\bresume\b/gi, "CV"],
  [/\bcurriculum vitae\b/gi, "CV"],
  [/\btuition fees\b/gi, "frais de scolarité"],
  [/\bfull tuition\b/gi, "frais de scolarité complets"],
  [/\btuition\b/gi, "frais de scolarité"],
  [/\bliving expenses\b/gi, "frais de vie"],
  [/\bmonthly stipend\b/gi, "allocation mensuelle"],
  [/\bstipend\b/gi, "allocation"],
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
  /** Continuous narrative (4-6 sentences) for IG carousel slides */
  frNarrative?: string;
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

  const proseAlreadyHasSource = proseBlocks.some(containsInlineSourceAttribution);
  if (proseAlreadyHasSource) {
    const filtered = keptBlocks.filter(
      (block) => !isStandaloneSourceBlock(block),
    );
    if (filtered.length > 0) {
      return truncateCaption(filtered.join("\n\n"));
    }
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
 * Capped to fit the renderer's sourceLine template zone (≤55 chars, ≤8 words).
 */
/**
 * Domains that are aggregators/redirectors — the URL itself is not meaningful
 * to display, but the citation *label* (book title, author) is still valuable.
 * For these, we show "Source: <label>" without appending the domain.
 */
const HIDE_DOMAIN_HOSTS = new Set(["google.com", "news.google.com", "books.google.com"]);

function shouldHideDomain(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return HIDE_DOMAIN_HOSTS.has(host) || host.endsWith(".google.com");
  } catch {
    return false;
  }
}

/**
 * Pick the first available citation from the item (item.source, then citations[]).
 * Returns the name and url together so callers can decide whether to show the domain.
 */
function pickBestCitation(item: Item): { sourceName: string; sourceUrl?: string } | undefined {
  if (item.source?.name) {
    return { sourceName: item.source.name, sourceUrl: item.source.originalUrl };
  }
  const first = item.citations?.[0];
  if (first) return { sourceName: first.sourceName, sourceUrl: first.sourceUrl };
  return undefined;
}

export function buildSourceFooter(item: Item): string {
  const best = pickBestCitation(item);
  const sourceName = best?.sourceName ?? "Source";
  const raw = `Source: ${sourceName}`;
  // Template limit: 55 chars / 8 words. Cap source name so total fits.
  if (raw.length <= 55) return raw;
  // Truncate the source name portion to fit
  const maxNameLen = 55 - "Source: ".length - 1; // leave room for "…"
  const truncated = sourceName.slice(0, maxNameLen).replace(/[\s\-–—,;:]+$/, "");
  return `Source: ${truncated}…`;
}

export function buildSourceLine(item: Item): string {
  const best = pickBestCitation(item);
  const sourceName = best?.sourceName ?? "Source";
  const sourceUrl = best?.sourceUrl ?? item.canonicalUrl;
  // For aggregator/redirect domains (Google Books, Google News) the URL itself
  // is meaningless to display — show the label (book title, author) only.
  if (shouldHideDomain(sourceUrl)) {
    return `Source: ${sourceName}`;
  }
  try {
    const domain = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return `Source: ${sourceName} — ${domain}`;
  } catch {
    return `Source: ${sourceName}`;
  }
}

/**
 * Data contract for a standardised EdLight News Instagram caption.
 * Follows MASTER_PROMPT Section 7 caption formula:
 *   Hook → Context → Extras → Kreyòl → Hashtags → CTA → Source
 */
export interface CaptionData {
  /** Primary hook — displayed first. Typically the French article/post title. */
  title: string;
  /** Main context summary. Capped at `summaryCap` chars (default 320). */
  summary: string;
  /** Optional Kreyòl translation shown after extras. */
  htSummary?: string;
  /** Source attribution line (e.g. "Source: Le Nouvelliste — lenouvelliste.com"). */
  sourceLine: string;
  /** Extra lines inserted between context and Kreyòl (deadline, coverage, section highlights…). */
  extras?: string[];
  /** Hashtag block (e.g. "#ActuHaïti #HaitiNews #EdLightNews"). */
  hashtags: string;
  /** Max chars for the summary block. Defaults to 320. */
  summaryCap?: number;
}

/**
 * Build a standardised Instagram caption following the EdLight News formula:
 *   Hook → Context → Extras → Kreyòl → Hashtags → CTA → Source
 *
 * Replaces per-formatter ad-hoc caption assembly for consistent output.
 * Matches MASTER_PROMPT Section 7 (Caption Formula).
 */
export function buildCaption(data: CaptionData): string {
  const cap = data.summaryCap ?? 320;
  const parts: string[] = [data.title, "", shortenCaptionText(data.summary, cap)];
  const validExtras = (data.extras ?? []).filter(Boolean);
  if (validExtras.length > 0) {
    parts.push("", ...validExtras);
  }
  if (data.htSummary) {
    parts.push("", `🇭🇹 ${shortenCaptionText(data.htSummary, 280)}`);
  }
  parts.push("", data.hashtags);
  parts.push("", buildCTA(), "", data.sourceLine);
  return finalizeCaption(parts.join("\n"));
}

/**
 * Shorten text to a maximum character length, breaking at sentence boundary.
 * Strongly prefers complete sentences over mid-sentence truncation.
 */
export function shortenText(text: string, max: number): string {
  if (text.length <= max) return text;

  // Prefer ending at the last complete sentence inside the budget.
  // Look for sentence-ending punctuation followed by a space (or end-of-string).
  const window = text.slice(0, max);
  const sentenceRe = /[.!?][)"'»]?(?:\s|$)/g;
  let lastCut = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(window)) !== null) {
    // Include the punctuation (and optional closing quote) but not the trailing space
    const cutAt = m.index + m[0].trimEnd().length;
    // Accept sentence boundaries from 35% onwards (more aggressive than before)
    if (cutAt >= max * 0.35) lastCut = cutAt;
  }
  if (lastCut > 0) return text.slice(0, lastCut).trim();

  // Second chance: check if text ends with sentence punctuation just past the budget
  // (i.e. the sentence is only slightly too long). If within 15% overshoot, allow it.
  const slightOvershoot = text.slice(0, Math.floor(max * 1.15));
  const overRe = /[.!?][)"'»]?(?:\s|$)/g;
  let firstPastBudget: number | null = null;
  while ((m = overRe.exec(slightOvershoot)) !== null) {
    const cutAt = m.index + m[0].trimEnd().length;
    if (cutAt > max && firstPastBudget === null) {
      firstPastBudget = cutAt;
      break;
    }
  }
  if (firstPastBudget !== null) return text.slice(0, firstPastBudget).trim();

  // Fallback: word boundary + ellipsis
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  let cutStr = lastSpace > max * 0.5 ? truncated.slice(0, lastSpace) : truncated;
  // Strip orphan unclosed parenthetical opener, e.g. "(re" from "(re)découvrir".
  // These appear when a compound-word parenthetical falls exactly at the cut point.
  cutStr = cutStr.replace(/\s+\([^)]{0,30}$/, "").replace(/\([^)]{0,30}$/, "").trimEnd();
  return cutStr + "…";
}

// ── Post-reviewer bullet budget enforcement ─────────────────────────────────
// Char budgets derived from renderer zone configs (templateLimits.ts).
// Keep in sync with the per-formatter constants (histoire.ts, news.ts, etc.).

/** Cover deck / supportLine: 34 px Inter, 900 px, 3-line clamp → ~150 safe chars.
 *  Actual pixel capacity: 900/(34×0.52) × 3 ≈ 153. With word-wrap loss the
 *  safe working limit is ~150. */
const DECK_LINE_BUDGET  = 150;
/** Cover body facts: 28 px Inter, 900 px, 2-line clamp → ~110 safe chars. */
const COVER_BODY_BUDGET = 110;
/** Detail body bullets: 32 px Inter, 900 px, 4-line clamp → ~160 safe chars. */
const DETAIL_BULLET_BUDGET = 160;

/**
 * Re-apply char budgets on every slide's bullets.
 *
 * The reviewer LLM can rewrite bullets to any length. This function runs
 * after the reviewer returns to ensure no bullet exceeds its zone's pixel
 * capacity. Uses the same `shortenText` sentence-boundary logic so we never
 * get ugly mid-word truncation.
 *
 * Cover slide (index 0, layout "headline"):
 *   bullet[0] → deckLine / supportLine  (DECK_LINE_BUDGET)
 *   bullet[1+] → body facts             (COVER_BODY_BUDGET)
 * CTA slides are left untouched.
 * All other slides → DETAIL_BULLET_BUDGET.
 */
export function enforceBulletBudgets(payload: IGFormattedPayload): IGFormattedPayload {
  const slides = payload.slides.map((slide, idx) => {
    // CTA slides: short by design, skip
    if (slide.layout === "cta") return slide;

    // Cover slide: first slide with layout "headline"
    if (idx === 0 && slide.layout === "headline") {
      return {
        ...slide,
        bullets: slide.bullets.map((b, bi) =>
          shortenText(b, bi === 0 ? DECK_LINE_BUDGET : COVER_BODY_BUDGET),
        ),
      };
    }

    // Detail / explanation slides
    return {
      ...slide,
      bullets: slide.bullets.map((b) => shortenText(b, DETAIL_BULLET_BUDGET)),
    };
  });
  return { ...payload, slides };
}

/**
 * Shorten a headline to at most `maxWords` words AND `maxChars` characters.
 * At 88px hero font with CSS clamp 7, ~130 chars fit comfortably.
 * Prefers cutting at clause boundaries (comma, semicolon, colon, dash) to
 * avoid mid-phrase "…" that looks incomplete.
 */
export function shortenHeadline(text: string, maxWords = 10, maxChars = 130): string {
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

  // If we only word-truncated and it fits in maxChars, try to end at a
  // clause boundary for a cleaner cut. Never append "…" — the rendering
  // pipeline's CSS line-clamp serves as the visual safety net if text
  // still overflows, and the rewrite engine handles pixel-level fit.
  if (wordTruncated) {
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
    // Return the word-trimmed result as-is — no ellipsis.
    return result;
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
 * For Google News redirects → "Voir les détails" (real URL is buried in redirect)
 */
export function humanizeUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    // Google News redirect URLs look like news.google.com/articles/… — the actual
    // destination URL is embedded in the redirect and we cannot follow it here.
    // Return a neutral label rather than "Postulez sur news.google.com".
    if (domain === "news.google.com") return "Voir les détails";
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
    || /^sources?\s*:/i.test(trimmed)
    || /lien dans la bio|lyen nan biyo/i.test(trimmed)
    || /https?:\/\//i.test(trimmed);
}

function isStandaloneSourceBlock(block: string): boolean {
  return /^sources?\s*:/i.test(block.trim());
}

function containsInlineSourceAttribution(block: string): boolean {
  const trimmed = block.trim();
  if (!trimmed) return false;
  if (isStandaloneSourceBlock(trimmed)) return false;
  return /(^|\n|[.!?]\s+)sources?\s*:/i.test(trimmed);
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
