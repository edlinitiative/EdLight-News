/**
 * Shared date utilities — consolidates duplicated helpers across pages.
 * tsToISO, formatDateLocalized, and month name constants.
 */

import type { ContentLanguage } from "@edlight-news/types";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Month name arrays (1-indexed via leading empty string) ──────────────────

export const MONTH_NAMES_FR = [
  "",
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

export const MONTH_NAMES_HT = [
  "",
  "janvye", "fevriye", "mas", "avril", "me", "jen",
  "jiyè", "out", "septanm", "oktòb", "novanm", "desanm",
] as const;

// Zero-indexed versions (for use with Date.getMonth())
export const MONTH_NAMES_FR_0 = MONTH_NAMES_FR.slice(1);
export const MONTH_NAMES_HT_0 = MONTH_NAMES_HT.slice(1);

// ── Firestore Timestamp → ISO string ────────────────────────────────────────

/** Convert a Firestore Timestamp-like value to an ISO string. */
export function tsToISO(v: unknown): string | undefined {
  if (!v || typeof v !== "object") return undefined;
  const t = v as { seconds?: number; _seconds?: number; toDate?: () => Date };
  const secs = t.seconds ?? t._seconds;
  if (typeof secs === "number") return new Date(secs * 1000).toISOString();
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return undefined;
}

/** Variant that returns null instead of undefined (JSON-safe). */
export function tsToISONull(v: unknown): string | null {
  return tsToISO(v) ?? null;
}

// ── Localized date formatting ───────────────────────────────────────────────

/** Format an ISO date string to a localized human-readable date. */
export function formatDateLocalized(
  iso: string | null | undefined,
  lang: ContentLanguage,
): string {
  if (!iso) return "";
  const parsed = parseDateInput(iso);
  if (!parsed) return iso;

  return parsed.toLocaleDateString(
    lang === "fr" ? "fr-FR" : "fr-HT",
    { day: "numeric", month: "long", year: "numeric" },
  );
}

/**
 * Parse either a full ISO datetime or a date-only string.
 * Date-only inputs are treated as local calendar dates to avoid timezone drift.
 */
export function parseDateInput(value: string): Date | null {
  try {
    const parsed = DATE_ONLY_RE.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}
