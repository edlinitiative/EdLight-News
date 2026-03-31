/**
 * Shared types for the tiered image sourcing pipeline.
 *
 * Every image source produces an `ImageCandidate` with rich metadata,
 * a `licenseStatus` safety tag, and a weighted composite score.
 */

// ── License safety classification ──────────────────────────────────────────

export type LicenseStatus =
  | "safe_public_domain"       // PD, PD-USGov, CC0 — no attribution needed
  | "official_reusable"        // Official gov/org media gallery — reuse permitted
  | "cc_attribution"           // CC BY / CC BY-SA — attribution required
  | "licensed_editorial"       // Reuters/AP/Getty — NOT auto-publishable
  | "unknown_do_not_publish";  // Unknown license — block from auto-posting

// ── Image source tier ──────────────────────────────────────────────────────

export type ImageSourceTier =
  | "official"     // Government/institutional press gallery, official Flickr
  | "editorial"    // Reuters, AP, Getty (need license)
  | "archive"      // Library of Congress, Wikimedia Commons, national archives
  | "stock"        // Unsplash, Pexels (high quality but generic)
  | "fallback";    // Branded gradient / template (last resort)

// ── Story classification ───────────────────────────────────────────────────

export type StoryType =
  | "person"    // Person-led: president, minister, opposition leader
  | "event"     // Event-led: summit, election, protest, parliament
  | "topic";    // Country/topic-led: inflation, law, sanctions, budget

// ── Image candidate (unified across all sources) ───────────────────────────

export interface ImageCandidate {
  /** Image URL ready for download / embedding */
  url: string;

  /** Which search backend found this image */
  source: "unsplash" | "wikimedia" | "flickr" | "loc" | "wikidata" | "official";

  /** Which tier this source belongs to */
  tier: ImageSourceTier;

  /** License safety classification */
  licenseStatus: LicenseStatus;

  /** Composite weighted score (0-100) */
  score: number;

  /** Individual score components (for debugging) */
  scoreBreakdown?: {
    relevance: number;   // 0-35
    trust: number;       // 0-20
    recency: number;     // 0-15
    quality: number;     // 0-15
    licensing: number;   // 0-15
  };

  // ── Dimensions ─────────────────────────────────────────────────────────
  width: number;
  height: number;

  // ── Metadata ───────────────────────────────────────────────────────────
  /** Source domain or service */
  sourceDomain?: string;
  /** Source type label */
  sourceType?: string;
  /** Person or entity name if relevant */
  entityName?: string;
  /** Country code (ISO 2-letter) */
  country?: string;
  /** Event/topic description */
  topic?: string;
  /** Photographer / credit line */
  author?: string;
  /** License name (e.g. "CC BY 4.0", "Public Domain") */
  license?: string;
  /** Original source page URL */
  sourceUrl?: string;
  /** Image capture date if known */
  captureDate?: string;
  /** Unsplash download tracking URL (must be triggered per TOS) */
  downloadLocation?: string;
}

// ── Official source entry (for the registry) ───────────────────────────────

export interface OfficialSourceEntry {
  /** ISO 2-letter country code or "intl" for international orgs */
  country: string;
  /** Institution or office name */
  institution: string;
  /** Flickr user ID (for Flickr API search) */
  flickrUserId?: string;
  /** Official media gallery URL (for future scraping) */
  galleryUrl?: string;
  /** License status for images from this source */
  licenseStatus: LicenseStatus;
  /** Trust score boost (0-20) */
  trustBoost: number;
  /** Tags for matching against story topics */
  tags: string[];
}
