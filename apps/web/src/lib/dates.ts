/**
 * Shared date utilities — consolidates duplicated helpers across pages.
 * tsToISO, formatDateLocalized, and month name constants.
 */

import type { ContentLanguage } from "@edlight-news/types";

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
  try {
    return new Date(iso).toLocaleDateString(
      lang === "fr" ? "fr-FR" : "fr-HT",
      { day: "numeric", month: "long", year: "numeric" },
    );
  } catch {
    return iso;
  }
}
