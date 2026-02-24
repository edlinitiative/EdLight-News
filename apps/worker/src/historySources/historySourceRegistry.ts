/**
 * History Source Registry
 *
 * Defines trusted domain lists for Haiti history sourcing,
 * and provides domain-level validation and classification.
 *
 * Rules:
 *  1. Government + academic = highest confidence
 *  2. Wikipedia alone = never verified
 *  3. Press must be corroborated if pre-1950 event
 */

import type { AlmanacRawSourceType } from "@edlight-news/types";

// ── Trusted domain lists ─────────────────────────────────────────────────────

export const TRUSTED_HISTORY_DOMAINS: Record<
  AlmanacRawSourceType,
  readonly string[]
> = {
  government: [
    ".gouv.ht",
    "menfp.gouv.ht",
    "brh.ht",
  ],
  academic: [
    ".edu",
    "jstor.org",
    "academia.edu",
  ],
  institutional: [
    "unesco.org",
    "un.org",
    "worldbank.org",
  ],
  press: [
    "lenouvelliste.com",
    "juno7.ht",
  ],
  reference: [
    "wikipedia.org",
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract hostname from URL, lowercased. Returns null for invalid URLs. */
function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Classify a URL against the trusted domain lists.
 * Returns the source type if the domain matches, or null if unknown.
 */
export function classifyDomain(url: string): AlmanacRawSourceType | null {
  const hostname = extractHostname(url);
  if (!hostname) return null;

  for (const [type, domains] of Object.entries(TRUSTED_HISTORY_DOMAINS)) {
    for (const domain of domains) {
      // Support suffix matching (e.g. ".edu" matches "harvard.edu")
      if (domain.startsWith(".")) {
        if (hostname.endsWith(domain) || hostname === domain.slice(1)) {
          return type as AlmanacRawSourceType;
        }
      } else {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return type as AlmanacRawSourceType;
        }
      }
    }
  }

  return null;
}

/**
 * Check whether a URL belongs to any trusted domain.
 */
export function isTrustedDomain(url: string): boolean {
  return classifyDomain(url) !== null;
}

/**
 * Returns true if the source type is high-confidence
 * (government, academic, or institutional).
 */
export function isHighConfidenceSourceType(
  sourceType: AlmanacRawSourceType,
): boolean {
  return (
    sourceType === "government" ||
    sourceType === "academic" ||
    sourceType === "institutional"
  );
}

/**
 * Returns true if this source alone can never be marked as "verified".
 * Currently only "reference" (Wikipedia) sources.
 */
export function isNeverVerifiedAlone(
  sourceType: AlmanacRawSourceType,
): boolean {
  return sourceType === "reference";
}

/**
 * Determine whether a press-only source needs corroboration.
 * Pre-1950 events require a second independent source when
 * the only source is press.
 */
export function pressNeedsCorroboration(year: number): boolean {
  return year < 1950;
}
