/**
 * Deterministic geo-classification for calendar & deadline items.
 *
 * Used by both the homepage calendar block and the /calendrier filter tabs
 * to ensure consistent "Haïti" vs "International" labelling.
 */

// ── Haitian domain detection ─────────────────────────────────────────────────

/** Well-known Haitian institutional domains (subset — the .ht TLD covers most). */
const HAITIAN_DOMAINS: readonly string[] = [
  "menfp.gouv.ht",
  "ueh.edu.ht",
  "gouvernement.ht",
  "primature.gouv.ht",
  "education.gouv.ht",
];

/** Returns true when the URL belongs to a Haitian domain (.ht TLD or explicit list). */
function isHaitianDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith(".ht")) return true;
    return HAITIAN_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Minimal shape accepted by {@link getCalendarGeoLabel}. */
export interface GeoClassifiable {
  geoTag?: string | null;
  country?: string | null;
  officialUrl?: string | null;
  sources?: { url: string }[] | null;
}

export type CalendarGeoLabel = "HT" | "International";

/**
 * Classify a calendar / deadline item as **"HT"** (Haïti) or **"International"**.
 *
 * Resolution order:
 *  1. Explicit `geoTag` field (e.g. from the parent Item).
 *  2. Explicit `country` field (e.g. from Scholarship).
 *  3. Domain inference from `officialUrl` or `sources[].url`.
 *  4. Fallback → "International".
 */
export function getCalendarGeoLabel(item: GeoClassifiable): CalendarGeoLabel {
  // 1. Explicit geoTag
  if (item.geoTag === "HT") return "HT";
  if (item.geoTag) return "International";

  // 2. Explicit country
  if (item.country === "HT") return "HT";

  // 3. Infer from URLs
  if (item.officialUrl && isHaitianDomain(item.officialUrl)) return "HT";
  if (item.sources?.some((s) => isHaitianDomain(s.url))) return "HT";

  // 4. Default
  return "International";
}
