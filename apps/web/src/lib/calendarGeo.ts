/**
 * Deterministic geo-classification for calendar & deadline items.
 *
 * Classifies items as "Haiti" (events happening inside Haiti) or
 * "International" (abroad deadlines — even if intended for Haitian students).
 *
 * Resolution order:
 *  1. Explicit geoTag
 *  2. Explicit country field
 *  3. Source / officialUrl domain heuristics
 *  4. Text heuristics (title, summary, institution, notes)
 *  5. Fallback → "International"
 */

// ── Public types ─────────────────────────────────────────────────────────────

export type CalendarGeo = "Haiti" | "International";

/** Flexible input shape accepted by {@link getCalendarGeo}. */
export interface CalendarGeoInput {
  geoTag?: string | null;
  country?: string | null;
  officialUrl?: string | null;
  institution?: string | null;
  sources?: { url: string }[] | null;
  title?: string | null;
  name?: string | null;
  summary?: string | null;
  notes?: string | null;
  eligibilitySummary?: string | null;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Normalise a string for comparison: lowercase, trim, strip accents. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Extract hostname from a URL; returns empty string on invalid input. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// ── Haitian domain patterns ──────────────────────────────────────────────────

const HAITIAN_DOMAIN_SUFFIXES: readonly string[] = [
  ".gouv.ht",
  ".edu.ht",
  ".ht",
];

const HAITIAN_DOMAIN_KEYWORDS: readonly string[] = [
  "ueh",
  "menfp",
  "brh",
];

function isHaitianDomain(host: string): boolean {
  if (!host) return false;
  if (HAITIAN_DOMAIN_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (HAITIAN_DOMAIN_KEYWORDS.some((k) => host.includes(k))) return true;
  return false;
}

// ── International domain patterns ────────────────────────────────────────────

const INTL_DOMAIN_SUFFIXES: readonly string[] = [
  ".gc.ca",
  ".gouv.fr",
  ".gov.uk",
  ".un.org",
];

const INTL_DOMAIN_EXACT: readonly string[] = [
  "canada.ca",
  "campusfrance.org",
  "chevening.org",
  "unesco.org",
  "auf.org",
];

function isInternationalDomain(host: string): boolean {
  if (!host) return false;
  if (INTL_DOMAIN_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (INTL_DOMAIN_EXACT.some((d) => host === d || host.endsWith(`.${d}`)))
    return true;
  return false;
}

// ── Text-based keywords ──────────────────────────────────────────────────────

const HAITI_TEXT_KEYWORDS: readonly string[] = [
  "menfp",
  "ueh",
  "ns4",
  "examens officiels",
  "baccalaureat",
];

/** Check text blob for Haiti-specific keywords (normalised). */
function textSignalsHaiti(blob: string): boolean {
  const n = norm(blob);
  // "bac" alone is ambiguous — match as a standalone word
  if (/\bbac\b/.test(n)) return true;
  return HAITI_TEXT_KEYWORDS.some((kw) => n.includes(norm(kw)));
}

// ── GeoTag / country matching ────────────────────────────────────────────────

const HAITI_GEO_TAGS = new Set(["ht", "haiti", "haïti"].map(norm));
const INTL_GEO_TAGS = new Set(["intl", "international"].map(norm));

const HAITI_COUNTRY_CODES = new Set(["ht", "haiti", "haïti"].map(norm));

// ── Main classifier ─────────────────────────────────────────────────────────

/**
 * Classify a calendar / deadline item as **"Haiti"** or **"International"**.
 *
 * - "Haiti" = events happening inside Haiti (MENFP, UEH, Haitian institutions).
 * - "International" = abroad deadlines (Canada, France, UK, etc.),
 *   even if intended for Haitian students.
 */
export function getCalendarGeo(item: CalendarGeoInput): CalendarGeo {
  // ── 1) Explicit geoTag ──────────────────────────────────────────────
  if (item.geoTag) {
    const tag = norm(item.geoTag);
    if (HAITI_GEO_TAGS.has(tag)) return "Haiti";
    if (INTL_GEO_TAGS.has(tag)) return "International";
    // Unknown tag — fall through to next heuristic
  }

  // ── 2) Explicit country field ───────────────────────────────────────
  if (item.country) {
    const c = norm(item.country);
    if (HAITI_COUNTRY_CODES.has(c)) return "Haiti";
    // Any other country is international
    return "International";
  }

  // ── 3) Domain heuristics (officialUrl + sources) ────────────────────
  const urls: string[] = [];
  if (item.officialUrl) urls.push(item.officialUrl);
  if (item.sources) {
    for (const s of item.sources) {
      if (s.url) urls.push(s.url);
    }
  }

  const hosts = urls.map(hostOf).filter(Boolean);

  // Check Haitian domains first
  if (hosts.some(isHaitianDomain)) return "Haiti";
  // Check international domains
  if (hosts.some(isInternationalDomain)) return "International";

  // ── 4) Text heuristics (last resort) ────────────────────────────────
  const textParts: string[] = [];
  if (item.title) textParts.push(item.title);
  if (item.name) textParts.push(item.name);
  if (item.summary) textParts.push(item.summary);
  if (item.notes) textParts.push(item.notes);
  if (item.institution) textParts.push(item.institution);
  if (item.eligibilitySummary) textParts.push(item.eligibilitySummary);

  const blob = textParts.join(" ");
  if (blob.length > 0 && textSignalsHaiti(blob)) return "Haiti";

  // ── 5) Fallback ─────────────────────────────────────────────────────
  return "International";
}
