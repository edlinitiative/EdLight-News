/**
 * Wikidata / Wikimedia portrait image fetcher.
 *
 * Detects public personalities from article titles, searches Wikidata for
 * a matching entity, and fetches the P18 (image) property to get a licensed
 * portrait from Wikimedia Commons.
 *
 * Only used when confidence is high (exact match on a well-known person).
 */

import type { ImageAttribution, EntityRef } from "@edlight-news/types";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// ── Person name detection ─────────────────────────────────────────────────

/**
 * Heuristic: detect a person name from an article title.
 *
 * Matches patterns like "First Last" or "First Middle Last" when the title
 * seems to be about a specific individual.
 *
 * Only triggers for categories likely to feature public figures.
 */
const PERSON_CATEGORIES = new Set([
  "news",
  "local_news",
  "scholarship",
  "event",
]);

/**
 * Common title prefixes (French/Creole) that precede a person's name.
 */
const NAME_TRIGGERS = [
  /^(?:le\s+pr[eé]sident|la\s+pr[eé]sidente)\s+(.+)/i,
  /^(?:le\s+premier\s+ministre|la\s+premi[eè]re\s+ministre)\s+(.+)/i,
  /^(?:le\s+ministre|la\s+ministre)\s+(.+)/i,
  /^(?:le\s+s[eé]nateur|la\s+s[eé]natrice)\s+(.+)/i,
  /^(?:le\s+d[eé]put[eé]|la\s+d[eé]put[eé]e)\s+(.+)/i,
  /^(?:le\s+docteur|dr\.?)\s+(.+)/i,
  /^(?:le\s+professeur|prof\.?)\s+(.+)/i,
  /^(?:monseigneur|mgr\.?)\s+(.+)/i,
];

/**
 * Extract a potential person name from an article title.
 * Returns null if no confident match.
 */
export function detectPersonName(
  title: string,
  category?: string,
): string | null {
  if (category && !PERSON_CATEGORIES.has(category)) return null;

  const cleaned = title.trim();

  // Try trigger patterns
  for (const rx of NAME_TRIGGERS) {
    const m = cleaned.match(rx);
    if (m?.[1]) {
      const name = cleanPersonName(m[1]);
      if (isPlausibleName(name)) return name;
    }
  }

  // Try to find a "First Last" pattern at the start of the title
  // (before a colon, dash, or comma which usually starts the description)
  const beforePunctuation = cleaned.split(/\s*[:\-–—,|]\s*/)[0] ?? "";
  const words = beforePunctuation.trim().split(/\s+/);

  // A person name is 2-4 words, each capitalized
  if (words.length >= 2 && words.length <= 4) {
    const allCapitalized = words.every(
      (w) => /^[A-ZÀ-ÖÙ-Ý]/.test(w) && w.length >= 2,
    );
    if (allCapitalized) {
      const name = words.join(" ");
      if (isPlausibleName(name)) return name;
    }
  }

  return null;
}

/** Strip trailing noise from an extracted name. */
function cleanPersonName(raw: string): string {
  // First, split on obvious punctuation delimiters
  const afterPunctuation = raw.split(/\s*[:\-–—,|(]/)[0]!.trim();

  // Then take only leading capitalized words (the actual name).
  // Allow small French connectors that appear inside names (de, du, d', le, la).
  const NAME_CONNECTORS = new Set(["de", "du", "des", "d'", "le", "la", "les"]);
  const words = afterPunctuation.split(/\s+/);
  const nameWords: string[] = [];
  for (const w of words) {
    if (/^[A-ZÀ-ÖÙ-Ý]/.test(w) && w.length >= 2) {
      nameWords.push(w);
    } else if (NAME_CONNECTORS.has(w.toLowerCase()) && nameWords.length > 0) {
      nameWords.push(w);
    } else {
      break; // Stop at first non-name word (e.g., "annonce", "nommé")
    }
  }

  if (nameWords.length >= 2) return nameWords.join(" ");
  // Fallback to the punctuation-split version
  return afterPunctuation.replace(/\s{2,}/g, " ");
}

/** Basic sanity check for a person name. */
function isPlausibleName(name: string): boolean {
  const words = name.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Each word should be at least 2 chars
  if (words.some((w) => w.length < 2)) return false;
  // Should not contain numbers
  if (/\d/.test(name)) return false;
  // Should not be a common non-name phrase
  const lower = name.toLowerCase();
  const blacklist = [
    "breaking news", "flash info", "dernière heure",
    "communiqué de presse", "mise à jour", "urgent",
    "les états", "les nations", "le monde",
  ];
  if (blacklist.some((b) => lower.includes(b))) return false;
  return true;
}

// ── Wikidata API ──────────────────────────────────────────────────────────

export interface WikidataImageResult {
  imageUrl: string;
  attribution: ImageAttribution;
  entity: EntityRef;
}

/**
 * Search Wikidata for a person by name and return their P18 image if found.
 *
 * Only returns a result if:
 * - The search returns an entity labelled "human" (P31=Q5)
 * - The entity has a P18 (image) claim
 * - The label closely matches the input name
 */
export async function fetchWikidataImage(
  personName: string,
): Promise<WikidataImageResult | null> {
  try {
    // Step 1: Search Wikidata for the entity
    const searchUrl = new URL(WIKIDATA_API);
    searchUrl.searchParams.set("action", "wbsearchentities");
    searchUrl.searchParams.set("search", personName);
    searchUrl.searchParams.set("language", "fr");
    searchUrl.searchParams.set("uselang", "fr");
    searchUrl.searchParams.set("type", "item");
    searchUrl.searchParams.set("limit", "3");
    searchUrl.searchParams.set("format", "json");

    const searchRes = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!searchRes.ok) return null;

    const searchData = (await searchRes.json()) as {
      search?: Array<{
        id: string;
        label?: string;
        description?: string;
      }>;
    };

    if (!searchData.search?.length) return null;

    // Step 2: For each candidate, check if it's a human with P18
    for (const candidate of searchData.search) {
      const entityId = candidate.id;

      // Check label similarity
      const label = candidate.label?.toLowerCase() ?? "";
      const target = personName.toLowerCase();
      if (!isCloseMatch(label, target)) continue;

      // Fetch entity data (P31 = instance of, P18 = image)
      const entityUrl = new URL(WIKIDATA_API);
      entityUrl.searchParams.set("action", "wbgetentities");
      entityUrl.searchParams.set("ids", entityId);
      entityUrl.searchParams.set("props", "claims");
      entityUrl.searchParams.set("format", "json");

      const entityRes = await fetch(entityUrl.toString(), {
        signal: AbortSignal.timeout(10_000),
      });
      if (!entityRes.ok) continue;

      const entityData = (await entityRes.json()) as {
        entities?: Record<
          string,
          {
            claims?: Record<
              string,
              Array<{
                mainsnak?: {
                  datavalue?: {
                    value?: unknown;
                  };
                };
              }>
            >;
          }
        >;
      };

      const entity = entityData.entities?.[entityId];
      if (!entity?.claims) continue;

      // Check P31 (instance of) = Q5 (human)
      const p31Claims = entity.claims["P31"] ?? [];
      const isHuman = p31Claims.some((claim) => {
        const val = claim.mainsnak?.datavalue?.value;
        return (
          val &&
          typeof val === "object" &&
          "id" in val &&
          (val as { id: string }).id === "Q5"
        );
      });
      if (!isHuman) continue;

      // Get P18 (image) filename
      const p18Claims = entity.claims["P18"] ?? [];
      if (p18Claims.length === 0) continue;

      const imageFilename = p18Claims[0]?.mainsnak?.datavalue?.value;
      if (typeof imageFilename !== "string" || !imageFilename) continue;

      // Step 3: Build Wikimedia Commons image URL
      const imageUrl = buildCommonsImageUrl(imageFilename);

      // Step 4: Get license info
      const attribution = await fetchCommonsLicense(imageFilename);

      return {
        imageUrl,
        attribution,
        entity: {
          personName: candidate.label ?? personName,
          wikidataId: entityId,
        },
      };
    }

    return null;
  } catch (err) {
    console.warn(`[wikidata] Error fetching image for "${personName}":`, err);
    return null;
  }
}

/**
 * Build a Wikimedia Commons thumbnail URL from a filename.
 * Uses 800px width for reasonable quality.
 */
function buildCommonsImageUrl(filename: string): string {
  // Special: Wikimedia uses MD5 hash for directory structure
  const safeName = filename.replace(/ /g, "_");
  const encoded = encodeURIComponent(safeName);
  // Use the Special:FilePath endpoint which handles redirects
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=800`;
}

/**
 * Fetch license information for a Wikimedia Commons file.
 */
async function fetchCommonsLicense(
  filename: string,
): Promise<ImageAttribution> {
  try {
    const url = new URL(COMMONS_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", `File:${filename}`);
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "extmetadata");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return {};

    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            imageinfo?: Array<{
              extmetadata?: Record<string, { value?: string }>;
            }>;
          }
        >;
      };
    };

    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const meta = page?.imageinfo?.[0]?.extmetadata;

    return {
      name: meta?.["Artist"]?.value?.replace(/<[^>]+>/g, "").trim() || undefined,
      license: meta?.["LicenseShortName"]?.value || undefined,
      url: meta?.["LicenseUrl"]?.value || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Check if two strings are a close match (case-insensitive, accent-insensitive).
 */
function isCloseMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  const na = normalize(a);
  const nb = normalize(b);

  // Exact match
  if (na === nb) return true;
  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return true;

  return false;
}
