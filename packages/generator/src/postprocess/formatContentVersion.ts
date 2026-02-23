/**
 * @edlight-news/generator — Content Version Post-Processor
 *
 * Enforces a consistent house style across ALL series (History, Scholarships,
 * StudyAbroad, Career, News, Synthesis, etc.).
 *
 * Runs AFTER generation and BEFORE saving content_versions.
 * Also usable at render-time as a fallback for older unformatted content.
 *
 * Guarantee: no meaning change — only formatting + normalisation.
 */

// ── Public types ────────────────────────────────────────────────────────────

export interface ContentSection {
  heading: string;
  content: string;
}

export interface SourceCitation {
  name: string;
  url: string;
}

export interface FormatContentVersionInput {
  lang: "fr" | "ht";
  title: string;
  summary?: string;
  sections?: ContentSection[];
  body?: string;
  sourceCitations?: SourceCitation[];
  series?: string; // utilityMeta.series or "News"
}

export interface FormatContentVersionOutput {
  title: string;
  summary?: string;
  sections?: ContentSection[];
  body?: string;
  sourceCitations?: SourceCitation[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const HT_MONTHS = [
  "janvye", "fevriye", "mas", "avril", "me", "jen",
  "jiyè", "out", "septanm", "oktòb", "novanm", "desanm",
];

/** Capitalised month tokens → lowercase (FR) */
const FR_MONTH_MAP = new Map<string, string>(
  FR_MONTHS.map((m) => [m.charAt(0).toUpperCase() + m.slice(1), m]),
);

/** Capitalised month tokens → lowercase (HT) */
const HT_MONTH_MAP = new Map<string, string>(
  HT_MONTHS.map((m) => [m.charAt(0).toUpperCase() + m.slice(1), m]),
);

/** Series that should have inline sources sections appended */
const INLINE_SOURCE_SERIES = new Set([
  "HaitiHistory",
  "ScholarshipRadar",
  "ScholarshipRadarWeekly",
  "StudyAbroad",
  "Career",
  "HaitianOfTheWeek",
]);

/** Emoji regex: matches leading emoji characters (common ranges) */
const LEADING_EMOJI_RE =
  /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+\s*/u;

/** Trailing heading punctuation */
const TRAILING_HEADING_PUNCT_RE = /[\.:;\u2014]+$/;

/** Paragraph split target range */
const PARA_MAX = 450;
const PARA_TARGET = 380;

/** Sentence boundary splitter (splits after . ! ?) */
const SENTENCE_END_RE = /(?<=[.!?])\s+/;

/** Standalone large number (4+ digits, not inside URL or year-range) */
const LARGE_NUMBER_RE = /(?<![/\w.-])(\d{4,})(?![/\w.-])/g;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Collapse multiple spaces to one */
function collapseSpaces(s: string): string {
  return s.replace(/ {2,}/g, " ");
}

/** Normalise whitespace: trim lines, collapse 3+ newlines to 2 */
function normaliseWhitespace(s: string): string {
  return s
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Remove leading emoji from a heading */
function stripLeadingEmoji(s: string): string {
  return s.replace(LEADING_EMOJI_RE, "");
}

/** Remove trailing punctuation from headings */
function stripTrailingPunct(s: string): string {
  return s.replace(TRAILING_HEADING_PUNCT_RE, "");
}

/** Normalise a heading: trim, strip emoji, strip trailing punct, collapse spaces */
function normaliseHeading(s: string): string {
  let h = s.trim();
  h = stripLeadingEmoji(h);
  h = stripTrailingPunct(h);
  h = collapseSpaces(h);
  return h.trim();
}

/**
 * Split a paragraph that exceeds PARA_MAX chars into multiple
 * paragraphs at sentence boundaries, each ≤ PARA_TARGET chars
 * (or as close as possible).
 */
function splitLongParagraph(para: string): string[] {
  if (para.length <= PARA_MAX) return [para];

  const sentences = para.split(SENTENCE_END_RE).filter(Boolean);
  if (sentences.length <= 1) return [para]; // can't split further

  const result: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > PARA_TARGET && current.length > 0) {
      result.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) result.push(current.trim());

  return result;
}

/**
 * Apply paragraph splitting to a block of text (multiple paragraphs
 * separated by double newlines).
 */
function splitParagraphs(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  const processed = paragraphs.flatMap((p) => {
    const trimmed = p.trim();
    if (!trimmed) return [];
    // Don't split headings (lines starting with #)
    if (trimmed.startsWith("#")) return [trimmed];
    // Don't split bullet lists
    if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) return [trimmed];
    return splitLongParagraph(trimmed);
  });
  return processed.join("\n\n");
}

/**
 * Normalise "À confirmer" variants.
 *
 * FR: "a confirmer" | "à Confirmer" | "A confirmer" | "A CONFIRMER" → "À confirmer"
 * HT: "a konfime" | "pou konfime" (any case) → "Pou konfime"
 */
function normaliseConfirmer(text: string, lang: "fr" | "ht"): string {
  if (lang === "fr") {
    // \b doesn't work before accented chars — use lookbehind for non-alpha or start
    return text.replace(
      /(?<=^|[\s:,;.!()\-])[aà]\s+confirmer\b/gi,
      "À confirmer",
    );
  }
  // HT
  return text.replace(
    /\b(?:a|pou)\s+konfime\b/gi,
    "Pou konfime",
  );
}

/**
 * Normalise month names.
 *
 * FR: Capitalised month → lowercase (Mars → mars, Avril → avril)
 * HT: Capitalised month → lowercase (Mas → mas, Septanm → septanm)
 *
 * Only replaces exact word-boundary tokens — never substrings.
 */
function normaliseMonths(text: string, lang: "fr" | "ht"): string {
  const map = lang === "fr" ? FR_MONTH_MAP : HT_MONTH_MAP;
  let result = text;
  for (const [cap, lower] of map) {
    // Word-boundary match to avoid substring replacement
    const re = new RegExp(`\\b${cap}\\b`, "g");
    result = result.replace(re, lower);
  }
  return result;
}

/**
 * Format large standalone numbers with French-style thin space grouping.
 * e.g. 10000 → 10 000, 1500000 → 1 500 000
 * Excludes years (1800–2100).
 */
function formatNumbers(text: string): string {
  return text.replace(LARGE_NUMBER_RE, (match) => {
    const num = parseInt(match, 10);
    // Don't format likely years
    if (num >= 1800 && num <= 2100) return match;
    // French number formatting with thin space
    return num.toLocaleString("fr-FR").replace(/\u202F/g, " ");
  });
}

// ── Source citation helpers ──────────────────────────────────────────────────

/** Normalise a single URL: trim, ensure http(s) prefix */
function normaliseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Extract domain from URL for fallback source name */
function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

/** Deduplicate sources by normalised URL */
function deduplicateSources(sources: SourceCitation[]): SourceCitation[] {
  const seen = new Map<string, SourceCitation>();
  for (const src of sources) {
    const normUrl = normaliseUrl(src.url).toLowerCase();
    if (!seen.has(normUrl)) {
      seen.set(normUrl, {
        name: src.name?.trim() || domainFromUrl(normUrl),
        url: normaliseUrl(src.url),
      });
    }
  }
  return [...seen.values()];
}

/** Check if sections already contain a "Sources" heading */
function hasSourcesSection(sections: ContentSection[]): boolean {
  return sections.some(
    (s) => /^sources?$/i.test(s.heading.trim()) || /^sous$/i.test(s.heading.trim()),
  );
}

/** Build inline sources section content */
function buildSourcesSectionContent(sources: SourceCitation[]): string {
  return sources.map((s) => `• ${s.name} — ${s.url}`).join("\n");
}

// ── Text pipeline ───────────────────────────────────────────────────────────

/** Apply all text-level transformations to a block of content */
function processText(text: string, lang: "fr" | "ht"): string {
  let result = text;
  result = collapseSpaces(result);
  result = normaliseWhitespace(result);
  result = normaliseConfirmer(result, lang);
  result = normaliseMonths(result, lang);
  result = formatNumbers(result);
  result = splitParagraphs(result);
  return result;
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Post-process a content version for consistent house style.
 *
 * This is a pure function — no side-effects, no async, no Firestore.
 * Safe to call at generation-time AND render-time.
 */
export function formatContentVersion(
  input: FormatContentVersionInput,
): FormatContentVersionOutput {
  const { lang, series } = input;

  // 1. Title cleanup
  let title = (input.title ?? "").trim();
  title = stripLeadingEmoji(title);
  title = stripTrailingPunct(title);
  title = collapseSpaces(title);

  // 2. Summary
  let summary: string | undefined;
  if (input.summary) {
    summary = processText(input.summary, lang);
  }

  // 3. Sections
  let sections: ContentSection[] | undefined;
  if (input.sections && input.sections.length > 0) {
    sections = input.sections.map((s) => ({
      heading: normaliseHeading(s.heading),
      content: processText(s.content, lang),
    }));
  }

  // 4. Body (alternative to sections for some content types)
  let body: string | undefined;
  if (input.body) {
    body = processText(input.body, lang);
  }

  // 5. Source citations: normalise URLs, deduplicate, fill empty names
  let sourceCitations: SourceCitation[] | undefined;
  if (input.sourceCitations && input.sourceCitations.length > 0) {
    sourceCitations = deduplicateSources(input.sourceCitations);
  }

  // 6. Inline sources section (for non-News series with sourceCitations)
  const shouldInlineSources =
    series !== undefined &&
    series !== "News" &&
    INLINE_SOURCE_SERIES.has(series);

  if (
    shouldInlineSources &&
    sourceCitations &&
    sourceCitations.length > 0 &&
    sections &&
    !hasSourcesSection(sections)
  ) {
    const heading = lang === "ht" ? "Sous" : "Sources";
    sections = [
      ...sections,
      { heading, content: buildSourcesSectionContent(sourceCitations) },
    ];
  }

  return {
    title,
    ...(summary !== undefined ? { summary } : {}),
    ...(sections !== undefined ? { sections } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(sourceCitations !== undefined ? { sourceCitations } : {}),
  };
}
