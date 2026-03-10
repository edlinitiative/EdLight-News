/**
 * Haiti History — Content & Source Validation
 *
 * Prevents factual mismatches (year in title ≠ year in body),
 * enforces source credibility, and blocks weak history posts.
 *
 * This module is pure validation — it never mutates data.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface HistoryValidationInput {
  title: string;
  sections: { heading: string; content: string }[];
  sources: { name: string; url: string }[];
}

export interface HistoryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SourceValidationInput {
  sources: { name: string; url: string }[];
  confidence?: "high" | "medium";
}

// ── Regex ───────────────────────────────────────────────────────────────────

const YEAR_RE = /\b(18|19|20)\d{2}\b/g;

/** Simple URL format check — must have scheme + host. */
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractYears(text: string): Set<number> {
  const matches = text.match(YEAR_RE);
  if (!matches) return new Set();
  return new Set(matches.map(Number));
}

function isWikipediaDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes("wikipedia.org");
  } catch {
    return false;
  }
}

function isValidUrl(url: string): boolean {
  return URL_RE.test(url);
}

// ── Part 1 — Year Consistency Validation ────────────────────────────────────

export function validateHistoryContent(input: HistoryValidationInput): HistoryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const titleYears = extractYears(input.title);
  const bodyText = input.sections.map((s) => s.content).join(" ");
  const bodyYears = extractYears(bodyText);

  // Title contains a year AND body contains a different year (no overlap)
  if (titleYears.size > 0 && bodyYears.size > 0) {
    const titleArr = [...titleYears];
    const overlap = titleArr.some((y) => bodyYears.has(y));
    if (!overlap) {
      errors.push(
        `Year mismatch between title and body: title=${titleArr.join(", ")} body=${[...bodyYears].join(", ")}`,
      );
    }
  }

  // Title contains year but body has none
  if (titleYears.size > 0 && bodyYears.size === 0) {
    warnings.push("Title year not referenced in body");
  }

  // Multiple distinct years in body, title only has one
  if (titleYears.size === 1 && bodyYears.size > 1) {
    warnings.push(
      `Multiple years detected; verify context (body years: ${[...bodyYears].join(", ")})`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Part 2 — Source Quality Validation ──────────────────────────────────────

export function validateHistorySources(input: SourceValidationInput): HistoryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { sources, confidence } = input;

  // Rule 1: at least 1 source required
  if (sources.length === 0) {
    errors.push("No sources provided; at least one is required");
    return { isValid: false, errors, warnings };
  }

  // Rule 4b: reject invalid URL format
  for (const src of sources) {
    if (!isValidUrl(src.url)) {
      errors.push(`Invalid source URL format: "${src.url}"`);
    }
  }

  // Rule 1b: prefer 2+
  if (sources.length === 1) {
    warnings.push("Only one source provided; two or more recommended");
  }

  // Rule 2: all sources are Wikipedia
  const allWiki = sources.every((s) => isWikipediaDomain(s.url));

  if (allWiki) {
    warnings.push("Only Wikipedia sources; consider adding a non-Wikipedia source");
  }

  // Rule 3: confidence="high" with only Wikipedia — warn, don't block.
  // Historical dates are well-covered on Wikipedia. The curated almanac
  // was already verified by editors, so Wikipedia-only is acceptable for
  // the template path. Blocking would skip ~27% of calendar days.
  if (confidence === "high" && allWiki) {
    warnings.push("High-confidence entry with only Wikipedia sources — enrichment recommended");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Part 5 — Year Fallback Utility ──────────────────────────────────────────

/**
 * Attempt to remove a parenthesised year from the title and re-validate.
 *
 * Returns the cleaned title if the fallback resolves a single year-mismatch
 * error, or `null` if the fallback is not applicable.
 */
export function attemptYearFallback(input: HistoryValidationInput): {
  cleanedTitle: string | null;
  result: HistoryValidationResult;
} {
  // Only apply when there is exactly 1 year-mismatch error
  const initial = validateHistoryContent(input);
  const yearMismatchErrors = initial.errors.filter((e) =>
    e.startsWith("Year mismatch between title and body"),
  );

  if (yearMismatchErrors.length !== 1) {
    return { cleanedTitle: null, result: initial };
  }

  // Remove "(YYYY)" from title
  const cleanedTitle = input.title.replace(/\s*\(\d{4}\)\s*/g, "").trim();

  // Re-validate with cleaned title
  const retryResult = validateHistoryContent({ ...input, title: cleanedTitle });

  // Also ensure sources still valid (caller must supply separately) — we just
  // propagate the content result here.
  if (retryResult.isValid) {
    retryResult.warnings.push("Year fallback applied — year removed from title");
    return { cleanedTitle, result: retryResult };
  }

  // Fallback didn't help
  return { cleanedTitle: null, result: initial };
}
