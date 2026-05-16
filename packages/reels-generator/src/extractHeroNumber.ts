/**
 * extractHeroNumber — pick the most editorially-salient number from an item's
 * headline + summary for use as the hero of a `BigStatistic` reel.
 *
 * Why this exists: the first test reel for a scholarship picked "2026" (the
 * year) as the hero number simply because it appeared most often in the text.
 * Years alone are almost never the right hero — the deadline, count, or
 * currency amount is what the viewer cares about.
 *
 * Salience hierarchy (highest first):
 *   currency  → "$50,000", "50K USD", "5.000.000 HTG", "5 000 € "
 *   deadline  → "15 mars 2026", "15/03/2026", "avant le 30 juin"
 *   count     → "250 places", "100 bourses", "30 lauréats"
 *   percentage → "63 %", "63%"
 *   year      → bare 4-digit year (intentionally low — rarely the hero)
 *
 * Returns the highest-salience match. Returns null if no salient number is
 * present, which signals `pickTemplate` to downgrade off BigStatistic.
 */

export type HeroNumberKind =
  | "currency"
  | "deadline"
  | "count"
  | "percentage"
  | "year";

export interface HeroNumber {
  /** Display string (already formatted for the template). */
  value: string;
  kind: HeroNumberKind;
  /** Higher = more editorially valuable; ties broken by source order. */
  salience: number;
}

export const HERO_NUMBER_SALIENCE: Record<HeroNumberKind, number> = {
  currency: 100,
  deadline: 90,
  count: 75,
  percentage: 60,
  year: 5,
};

/** Source fields scanned for hero numbers. */
export interface HeroNumberSource {
  title?: string;
  summary?: string;
  /** Optional structured hint — e.g. `{ deadline: "2026-03-15", amount_usd: 50000 }`. */
  structured?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Extract the most salient number from an item, or null if none qualifies.
 *
 * Implementation notes:
 *   - We scan title + summary as a single string, then layer structured hints.
 *   - Currency detection covers $, USD, HTG, EUR, €, and "K"/"M"/"million"
 *     suffixes. Thousands separators may be `.`, `,`, or thin space.
 *   - Deadlines: French date patterns ("15 mars 2026", "15/03/2026") plus
 *     ISO ("2026-03-15"). We do NOT classify a bare year as a deadline.
 *   - Years are detected only when they appear as a bare 4-digit number
 *     between 1900 and 2099 and were not already swallowed by a deadline match.
 *   - First match wins per kind (we don't dedupe — picking the highest-salience
 *     across kinds handles overlap naturally).
 */
export function extractHeroNumber(source: HeroNumberSource): HeroNumber | null {
  const text = [source.title ?? "", source.summary ?? ""]
    .filter(Boolean)
    .join("\n");

  const candidates: HeroNumber[] = [];

  // ── Structured hints (highest confidence) ─────────────────────────────
  if (source.structured) {
    const s = source.structured;
    if (typeof s.amount_usd === "number" && s.amount_usd > 0) {
      candidates.push({
        value: formatCurrency(s.amount_usd, "USD"),
        kind: "currency",
        salience: HERO_NUMBER_SALIENCE.currency + 5,
      });
    }
    if (typeof s.amount_htg === "number" && s.amount_htg > 0) {
      candidates.push({
        value: formatCurrency(s.amount_htg, "HTG"),
        kind: "currency",
        salience: HERO_NUMBER_SALIENCE.currency + 5,
      });
    }
    if (typeof s.deadline === "string") {
      const d = formatDeadlineString(s.deadline);
      if (d) {
        candidates.push({
          value: d,
          kind: "deadline",
          salience: HERO_NUMBER_SALIENCE.deadline + 5,
        });
      }
    }
    if (typeof s.count === "number" && s.count > 0) {
      candidates.push({
        value: `${formatInt(s.count)}`,
        kind: "count",
        salience: HERO_NUMBER_SALIENCE.count + 5,
      });
    }
  }

  // ── Currency in free text ─────────────────────────────────────────────
  //
  // Examples we want to catch:
  //   "$50,000", "50 000 USD", "5K USD", "10 millions HTG", "€2.500"
  //
  // The K/M/million suffix is anchored with `\b` so we don't match "15 M" out
  // of "15 mars" (the `M` of "mars" — a French month — is not a magnitude).
  const currencyRe =
    /(?:\$\s?)?(\d{1,3}(?:[ \u00A0\.,]\d{3})+|\d+)(?:[ \u00A0]?(?:K\b|M\b|millions?\b|milliards?\b))?\s?(USD|HTG|EUR|€|\$|FCFA)?/gi;
  for (const m of text.matchAll(currencyRe)) {
    const raw = m[0];
    // Reject if it's clearly just a year (e.g. " 2026 " with no currency tag).
    if (/^\d{4}$/.test(raw.trim()) && !/(USD|HTG|EUR|€|\$|FCFA)/i.test(raw)) {
      continue;
    }
    // Require at least one of: leading $, trailing currency tag, or a
    // word-bounded K/M/millions suffix (avoids matching "15 M" of "15 mars").
    if (
      raw.includes("$") ||
      /(USD|HTG|EUR|€|FCFA)/i.test(raw) ||
      /\b(K|M|millions?|milliards?)\b/i.test(raw)
    ) {
      candidates.push({
        value: normalizeCurrencyDisplay(raw),
        kind: "currency",
        salience: HERO_NUMBER_SALIENCE.currency,
      });
      break; // first currency match wins
    }
  }

  // ── Deadline in free text ─────────────────────────────────────────────
  //
  //   "15 mars 2026", "15/03/2026", "2026-03-15", "avant le 30 juin 2026"
  const FR_MONTHS =
    "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre";
  const deadlinePatterns: RegExp[] = [
    new RegExp(`(\\d{1,2})\\s+(${FR_MONTHS})(?:\\s+(\\d{4}))?`, "i"),
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
  ];
  for (const re of deadlinePatterns) {
    const m = text.match(re);
    if (m) {
      candidates.push({
        value: formatDeadlineMatch(m, re),
        kind: "deadline",
        salience: HERO_NUMBER_SALIENCE.deadline,
      });
      break;
    }
  }

  // ── Counts in free text ───────────────────────────────────────────────
  //
  //   "250 places", "100 bourses", "30 lauréats", "1500 étudiants"
  const COUNT_NOUNS =
    "places|bourses|lauréats|laureats|candidats|étudiants|etudiants|jeunes|écoles|ecoles|professeurs|enseignants|formations|stagiaires|opportunités|opportunites";
  const countRe = new RegExp(`(\\d{1,4}(?:[ \\u00A0\\.,]?\\d{3})?)\\s+(?:${COUNT_NOUNS})`, "i");
  const countMatch = text.match(countRe);
  if (countMatch) {
    candidates.push({
      value: normalizeIntDisplay(countMatch[1]!),
      kind: "count",
      salience: HERO_NUMBER_SALIENCE.count,
    });
  }

  // ── Percentages ───────────────────────────────────────────────────────
  const pctMatch = text.match(/(\d{1,3}(?:[.,]\d+)?)\s?%/);
  if (pctMatch) {
    candidates.push({
      value: `${pctMatch[1]} %`,
      kind: "percentage",
      salience: HERO_NUMBER_SALIENCE.percentage,
    });
  }

  // ── Bare year (low salience by design) ────────────────────────────────
  //
  // We only credit a year if it's standalone (preceded by start/space/punct and
  // followed by space/punct/end) AND no deadline candidate already covered it.
  const hasDeadline = candidates.some((c) => c.kind === "deadline");
  if (!hasDeadline) {
    const yearMatch = text.match(/(?<![\d/.-])\b(19|20)\d{2}\b(?![\d/.-])/);
    if (yearMatch) {
      candidates.push({
        value: yearMatch[0],
        kind: "year",
        salience: HERO_NUMBER_SALIENCE.year,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.salience - a.salience);
  return candidates[0]!;
}

// ── Formatting helpers ─────────────────────────────────────────────────

function formatCurrency(amount: number, currency: "USD" | "HTG" | "EUR"): string {
  const sym: Record<typeof currency, string> = {
    USD: "$",
    HTG: "HTG ",
    EUR: "€",
  };
  // Thresholds chosen for visual punch: large numbers compress to K/M.
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const trimmed = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1);
    return `${sym[currency]}${trimmed}M`;
  }
  if (amount >= 10_000) {
    const k = amount / 1_000;
    const trimmed = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${sym[currency]}${trimmed}K`;
  }
  return `${sym[currency]}${formatInt(amount)}`;
}

function formatInt(n: number): string {
  return n.toLocaleString("fr-FR").replace(/\u202f/g, " ");
}

function normalizeCurrencyDisplay(raw: string): string {
  // Strip wrapping whitespace; collapse internal whitespace; drop redundant
  // currency tags when the dollar sign is already present.
  return raw.replace(/\s+/g, " ").trim();
}

function normalizeIntDisplay(raw: string): string {
  // Try to parse the number to format it consistently; on failure, return raw.
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw.trim();
  const n = Number(digits);
  return Number.isFinite(n) ? formatInt(n) : raw.trim();
}

function formatDeadlineString(input: string): string | null {
  // Accept ISO `YYYY-MM-DD` or French free-text. Normalize to "15 mars 2026".
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const day = Number(iso[3]);
    const month = Number(iso[2]);
    const year = Number(iso[1]);
    return frenchDate(day, month, year);
  }
  const slash = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    return frenchDate(Number(slash[1]), Number(slash[2]), Number(slash[3]));
  }
  return input.trim() || null;
}

function formatDeadlineMatch(m: RegExpMatchArray, re: RegExp): string {
  const src = re.source;
  if (src.startsWith("(\\d{1,2})\\s+(j")) {
    // "15 mars 2026" style — return as-is, lightly normalized.
    return [m[1], m[2], m[3]].filter(Boolean).join(" ");
  }
  if (src.startsWith("(\\d{1,2})\\/")) {
    return frenchDate(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  if (src.startsWith("(\\d{4})-")) {
    return frenchDate(Number(m[3]), Number(m[2]), Number(m[1]));
  }
  return m[0];
}

const FRENCH_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function frenchDate(day: number, monthIdx1Based: number, year: number): string {
  const name = FRENCH_MONTHS[monthIdx1Based - 1] ?? "";
  return `${day} ${name} ${year}`.trim();
}
