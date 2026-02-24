/**
 * Deterministic geo-classification for news / feed items.
 *
 * Mirrors the pattern of `geo.ts` (calendar items) but operates on the
 * richer `FeedItem` shape so the /haiti page can hard-filter non-Haiti
 * content that slips through the Firestore geoTag alone.
 *
 * Resolution order:
 *  1. Explicit geoTag / country fields
 *  2. Source-domain inference (Haitian institutional TLDs)
 *  3. Haiti keyword scan in title / summary
 *  4. Explicit non-Haiti country keyword → International
 *  5. Fallback → Unknown
 */

// ── Public types ─────────────────────────────────────────────────────────────

export type ItemGeo = "Haiti" | "International" | "Unknown";

// ── Accepted item shape ──────────────────────────────────────────────────────

export interface ItemGeoInput {
  geoTag?: string | null;
  country?: string | null;
  location?: string | null;
  title: string;
  summary?: string;
  tags?: string[];
  sources?: { url: string; name?: string }[];
  publisher?: string;
}

// ── Internal constants ───────────────────────────────────────────────────────

const HAITI_GEO_TAGS = new Set(["ht", "haiti", "haïti"]);

/** Haitian institutional domain suffixes. */
const HAITIAN_DOMAIN_SUFFIXES: readonly string[] = [
  ".gouv.ht",
  ".edu.ht",
  ".ht",        // generic .ht TLD — must come after more-specific entries
];

/** Exact Haitian domains (no leading dot). */
const HAITIAN_DOMAIN_EXACT: readonly string[] = [
  "ueh.edu.ht",
  "brh.ht",
  "menfp.gouv.ht",
];

/** Haiti-related keywords (already lowercased + NFD-stripped where needed). */
const HAITI_KEYWORDS: readonly string[] = [
  "haiti",
  "haïti",
  "port-au-prince",
  "petion-ville",
  "pétion-ville",
  "cap-haitien",
  "cap-haïtien",
  "gonaives",
  "jacmel",
  "les cayes",
  "jeremie",
  "jerémie",
  "hinche",
  "miragoane",
  "okap",
];

/** Explicit non-Haiti country keywords → International (when no Haiti signal). */
const NON_HAITI_COUNTRY_KEYWORDS: readonly string[] = [
  "mexique",
  "mexico",
  "rd",
  "république dominicaine",
  "dominican",
  "canada",
  "france",
  "royaume-uni",
  "uk",
  "usa",
  "états-unis",
  "china",
  "russie",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isHaitianDomain(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (HAITIAN_DOMAIN_EXACT.some((d) => host === d || host.endsWith(`.${d}`))) {
    return true;
  }
  return HAITIAN_DOMAIN_SUFFIXES.some((s) => host.endsWith(s));
}

function textContainsAny(text: string, keywords: readonly string[]): boolean {
  const lower = normalize(text);
  return keywords.some((kw) => lower.includes(kw));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify a feed item as **Haiti**, **International**, or **Unknown**.
 *
 * Designed for the /haiti page filter: items that return `"Haiti"` are shown;
 * everything else is excluded.
 */
export function getItemGeo(item: ItemGeoInput): ItemGeo {
  // ── 1. Explicit geoTag / country ────────────────────────────────────────
  if (item.geoTag) {
    const tag = normalize(item.geoTag);
    if (HAITI_GEO_TAGS.has(tag)) return "Haiti";
    // Any other non-null geoTag (INTL, Diaspora, Global, …) → International
    return "International";
  }

  if (item.country) {
    const c = normalize(item.country);
    if (HAITI_GEO_TAGS.has(c)) return "Haiti";
    return "International";
  }

  // ── 2. Source-domain inference ──────────────────────────────────────────
  if (item.sources?.some((s) => isHaitianDomain(s.url))) {
    return "Haiti";
  }

  // ── 3. Haiti keyword scan (title + summary) ───────────────────────────
  const corpus = [item.title, item.summary ?? ""].join(" ");
  const hasHaitiSignal = textContainsAny(corpus, HAITI_KEYWORDS);
  if (hasHaitiSignal) return "Haiti";

  // ── 4. Explicit non-Haiti country keyword (no Haiti signal) ───────────
  if (textContainsAny(corpus, NON_HAITI_COUNTRY_KEYWORDS)) {
    return "International";
  }

  // ── 5. Fallback ───────────────────────────────────────────────────────
  return "Unknown";
}

// ── Student-focus keyword filter ─────────────────────────────────────────────

/** Education / student keywords for the optional "Haïti — Étudiants" mode. */
const STUDENT_KEYWORDS: readonly string[] = [
  "menfp",
  "bac",
  "examens",
  "ueh",
  "université",
  "universite",
  "admission",
  "inscription",
  "bourse",
  "stage",
  "formation",
  "école",
  "ecole",
  "campus",
];

/**
 * Returns `true` when the item's title or summary contains at least one
 * education / student keyword.  Used as a secondary filter in "Étudiants" mode.
 */
export function isStudentFocused(item: { title: string; summary?: string }): boolean {
  const corpus = [item.title, item.summary ?? ""].join(" ");
  return textContainsAny(corpus, STUDENT_KEYWORDS);
}
