/**
 * Source Quality Classification
 *
 * Deterministic tiered classification of source URLs for history enrichment.
 *
 *   tier1 — Government, academic, institutional (highest confidence)
 *   tier2 — Publisher sites, library catalogs, reputable encyclopedias
 *   tier3 — Wikipedia and other user-editable references
 *
 * Rules:
 *   • tier3 includes wikipedia.org (any subdomain)
 *   • tier1 includes .gouv.ht, menfp.gouv.ht, brh.ht, un.org, unesco.org,
 *     worldbank.org, .edu, loc.gov, jstor.org, gallica.bnf.fr, etc.
 *   • tier2 includes britannica.com, larousse.fr, smithsonianmag.com,
 *     reputable media, library catalogs, etc.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type SourceTier = "tier1" | "tier2" | "tier3";

// ── Domain lists (suffix-matching) ───────────────────────────────────────────

/**
 * Tier 1: Government, academic, and institutional sources.
 * Entries starting with "." are suffix-matched (e.g. ".edu" matches "harvard.edu").
 * Others are exact hostname matches or subdomain suffix matches.
 */
const TIER1_DOMAINS: readonly string[] = [
  // Haiti government
  ".gouv.ht",
  "menfp.gouv.ht",
  "brh.ht",
  "primature.gouv.ht",
  "bfrh.gouv.ht",
  // International organisations
  "un.org",
  "unesco.org",
  "worldbank.org",
  "unicef.org",
  "oas.org",
  // Academic
  ".edu",
  "jstor.org",
  "academia.edu",
  "scholar.google.com",
  "cairn.info",
  "persee.fr",
  "erudit.org",
  // Archives & libraries
  "loc.gov",
  "gallica.bnf.fr",
  "dloc.com",
  "archivesnationales.culture.gouv.fr",
  // Museums
  "nmaahc.si.edu",
  "mupanah.ht",
] as const;

/**
 * Tier 2: Publisher sites, reputable encyclopedias, library catalogs,
 * and reliable international media.
 */
const TIER2_DOMAINS: readonly string[] = [
  // Encyclopedias
  "britannica.com",
  "larousse.fr",
  // Museums & reference
  "smithsonianmag.com",
  "history.com",
  "nationalgeographic.com",
  // Reliable media
  "lenouvelliste.com",
  "alterpresse.org",
  "haitilibre.com",
  "ayibopost.com",
  "bbc.com",
  "theguardian.com",
  "nytimes.com",
  "lemonde.fr",
  "rfi.fr",
  "aljazeera.com",
  "reuters.com",
  "apnews.com",
  // Haiti-specific scholarship
  "haitianhistory.org",
  "windowsonhaiti.com",
] as const;

/**
 * Tier 3: User-editable references that cannot stand alone as verification.
 */
const TIER3_DOMAINS: readonly string[] = [
  "wikipedia.org",
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract hostname from URL, lowercased. Returns null for invalid URLs. */
function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Check whether a hostname matches a domain entry (suffix or exact). */
function matchesDomain(hostname: string, domain: string): boolean {
  if (domain.startsWith(".")) {
    // Suffix match: ".edu" matches "harvard.edu", "mit.edu"
    return hostname.endsWith(domain) || hostname === domain.slice(1);
  }
  // Exact or subdomain match: "un.org" matches "un.org" and "www.un.org"
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Check if hostname matches any domain in a list. */
function matchesAnyDomain(
  hostname: string,
  domains: readonly string[],
): boolean {
  return domains.some((d) => matchesDomain(hostname, d));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify a URL into a quality tier.
 *
 * Returns:
 *   "tier1" — government / academic / institutional
 *   "tier2" — publisher / encyclopedia / reliable media
 *   "tier3" — Wikipedia and user-editable references
 *   null    — unknown domain (not in any list)
 */
export function classifySource(url: string): SourceTier | null {
  const hostname = extractHostname(url);
  if (!hostname) return null;

  // Check tiers in order of priority
  if (matchesAnyDomain(hostname, TIER1_DOMAINS)) return "tier1";
  if (matchesAnyDomain(hostname, TIER2_DOMAINS)) return "tier2";
  if (matchesAnyDomain(hostname, TIER3_DOMAINS)) return "tier3";

  return null;
}

/**
 * Returns true if the URL belongs to Wikipedia (any language subdomain).
 */
export function isWikipedia(url: string): boolean {
  const hostname = extractHostname(url);
  if (!hostname) return false;
  return matchesDomain(hostname, "wikipedia.org");
}

/**
 * Returns true if the tier is acceptable for enrichment (tier1 or tier2).
 */
export function isEnrichmentQuality(tier: SourceTier): boolean {
  return tier === "tier1" || tier === "tier2";
}

/**
 * Sort tiers by quality (tier1 first, then tier2).
 */
export function compareTiers(a: SourceTier, b: SourceTier): number {
  const order: Record<SourceTier, number> = { tier1: 0, tier2: 1, tier3: 2 };
  return order[a] - order[b];
}
