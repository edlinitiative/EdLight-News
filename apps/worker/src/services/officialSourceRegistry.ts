/**
 * Curated registry of official image sources by country and institution.
 *
 * Used by the tiered image pipeline to search official government accounts
 * FIRST (highest trust) before falling back to stock/generic sources.
 *
 * Each entry maps a country + institution to:
 * - Flickr user IDs (for official press galleries)
 * - Gallery URLs (for future web scraping)
 * - Trust boost scores (added to the weighted scoring formula)
 * - License status (most government media is public domain or reusable)
 */

import type { OfficialSourceEntry } from "./imageTypes.js";

// ── Registry ───────────────────────────────────────────────────────────────

export const OFFICIAL_SOURCES: OfficialSourceEntry[] = [
  // ── Haiti ──────────────────────────────────────────────────────────────
  {
    country: "HT",
    institution: "Presidency of Haiti",
    flickrUserId: undefined, // No official Flickr; use Wikimedia/Commons
    galleryUrl: undefined,
    licenseStatus: "official_reusable",
    trustBoost: 18,
    tags: ["haiti", "président", "president", "palais national", "gouvernement"],
  },
  {
    country: "HT",
    institution: "Le Nouvelliste (Haiti)",
    galleryUrl: "https://lenouvelliste.com",
    licenseStatus: "licensed_editorial",
    trustBoost: 10,
    tags: ["haiti", "port-au-prince", "haïti"],
  },

  // ── United States ──────────────────────────────────────────────────────
  {
    country: "US",
    institution: "The White House",
    flickrUserId: "35591378@N03", // Official White House Flickr
    galleryUrl: "https://www.whitehouse.gov/media/",
    licenseStatus: "safe_public_domain",
    trustBoost: 20,
    tags: ["white house", "president", "états-unis", "united states", "usa", "maison blanche"],
  },
  {
    country: "US",
    institution: "U.S. State Department",
    flickrUserId: "9364837@N06",
    galleryUrl: "https://www.state.gov/photo-galleries/",
    licenseStatus: "safe_public_domain",
    trustBoost: 18,
    tags: ["state department", "diplomatie", "diplomacy", "secretary of state"],
  },
  {
    country: "US",
    institution: "U.S. Department of Defense",
    flickrUserId: "39955793@N07",
    galleryUrl: "https://www.defense.gov/Multimedia/Photos/",
    licenseStatus: "safe_public_domain",
    trustBoost: 18,
    tags: ["pentagon", "défense", "defense", "military", "militaire"],
  },
  {
    country: "US",
    institution: "Library of Congress",
    galleryUrl: "https://www.loc.gov/free-to-use/",
    licenseStatus: "safe_public_domain",
    trustBoost: 20,
    tags: ["history", "histoire", "historical", "archive", "congress"],
  },
  {
    country: "US",
    institution: "NASA",
    flickrUserId: "24662369@N07",
    licenseStatus: "safe_public_domain",
    trustBoost: 18,
    tags: ["nasa", "space", "espace", "satellite"],
  },

  // ── France ─────────────────────────────────────────────────────────────
  {
    country: "FR",
    institution: "Élysée Palace",
    flickrUserId: undefined,
    galleryUrl: "https://www.elysee.fr/la-presidence/les-photographies",
    licenseStatus: "official_reusable",
    trustBoost: 18,
    tags: ["france", "président", "élysée", "macron", "paris"],
  },
  {
    country: "FR",
    institution: "Assemblée Nationale (France)",
    flickrUserId: "152763682@N07",
    galleryUrl: "https://www.assemblee-nationale.fr",
    licenseStatus: "official_reusable",
    trustBoost: 15,
    tags: ["france", "assemblée nationale", "parlement", "député"],
  },
  {
    country: "FR",
    institution: "Sénat (France)",
    flickrUserId: "156816385@N08",
    licenseStatus: "official_reusable",
    trustBoost: 15,
    tags: ["france", "sénat", "sénateur", "luxembourg"],
  },

  // ── Canada ─────────────────────────────────────────────────────────────
  {
    country: "CA",
    institution: "Prime Minister of Canada",
    flickrUserId: "pmaborddumonde",
    galleryUrl: "https://www.pm.gc.ca/en/photos",
    licenseStatus: "official_reusable",
    trustBoost: 18,
    tags: ["canada", "premier ministre", "prime minister", "ottawa"],
  },

  // ── United Kingdom ─────────────────────────────────────────────────────
  {
    country: "GB",
    institution: "UK Government (Number 10)",
    flickrUserId: "number10gov",
    galleryUrl: "https://www.gov.uk/government/photos",
    licenseStatus: "official_reusable",
    trustBoost: 18,
    tags: ["uk", "royaume-uni", "prime minister", "downing", "london", "londres"],
  },

  // ── International Organizations ────────────────────────────────────────
  {
    country: "intl",
    institution: "United Nations",
    flickrUserId: "69583224@N05",
    galleryUrl: "https://www.unmultimedia.org/photo/",
    licenseStatus: "official_reusable",
    trustBoost: 18,
    tags: ["onu", "nations unies", "united nations", "un", "conseil de sécurité", "assemblée générale"],
  },
  {
    country: "intl",
    institution: "European Union / European Commission",
    flickrUserId: "european_parliament",
    galleryUrl: "https://multimedia.europarl.europa.eu",
    licenseStatus: "official_reusable",
    trustBoost: 15,
    tags: ["ue", "union européenne", "european union", "eu", "bruxelles", "brussels", "parlement européen"],
  },
  {
    country: "intl",
    institution: "World Bank",
    flickrUserId: "worldbank",
    galleryUrl: "https://www.worldbank.org/en/about/photo-gallery",
    licenseStatus: "cc_attribution",
    trustBoost: 15,
    tags: ["banque mondiale", "world bank", "développement", "development", "économie"],
  },
  {
    country: "intl",
    institution: "CARICOM",
    galleryUrl: "https://caricom.org/media/",
    licenseStatus: "official_reusable",
    trustBoost: 15,
    tags: ["caricom", "caraïbes", "caribbean", "communauté caribéenne"],
  },
  {
    country: "intl",
    institution: "African Union",
    flickrUserId: "au_commission",
    galleryUrl: "https://au.int/en/multimedia/photos",
    licenseStatus: "official_reusable",
    trustBoost: 15,
    tags: ["union africaine", "african union", "ua", "au", "addis ababa"],
  },
  {
    country: "intl",
    institution: "World Health Organization",
    flickrUserId: "who_images",
    galleryUrl: "https://www.who.int/images",
    licenseStatus: "cc_attribution",
    trustBoost: 15,
    tags: ["oms", "who", "santé", "health", "pandémie", "épidémie"],
  },

  // ── Dominican Republic ─────────────────────────────────────────────────
  {
    country: "DO",
    institution: "Presidency of the Dominican Republic",
    galleryUrl: "https://presidencia.gob.do",
    licenseStatus: "official_reusable",
    trustBoost: 15,
    tags: ["république dominicaine", "dominican republic", "santo domingo", "presidente"],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────

/**
 * Find official sources matching a set of keywords from the item title/summary.
 * Returns entries sorted by trust boost (highest first).
 */
export function findOfficialSources(keywords: string[]): OfficialSourceEntry[] {
  if (keywords.length === 0) return [];

  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  return OFFICIAL_SOURCES
    .filter((entry) =>
      entry.tags.some((tag) =>
        lowerKeywords.some((kw) => kw.includes(tag) || tag.includes(kw)),
      ),
    )
    .sort((a, b) => b.trustBoost - a.trustBoost);
}

/**
 * Find official sources for a specific country code.
 */
export function findSourcesByCountry(countryCode: string): OfficialSourceEntry[] {
  const code = countryCode.toUpperCase();
  return OFFICIAL_SOURCES.filter(
    (entry) => entry.country === code || entry.country === "intl",
  );
}

/**
 * Get all Flickr user IDs from matching official sources.
 */
export function getFlickrUserIds(entries: OfficialSourceEntry[]): string[] {
  return entries
    .filter((e) => e.flickrUserId)
    .map((e) => e.flickrUserId!);
}
