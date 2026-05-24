/**
 * classifyReelFormat — pure deterministic classifier from an item's
 * editorial metadata into one of the three v2 formats.
 *
 * No LLM call: the worker has already classified the item into a category
 * + vertical, and that signal plus a small keyword fallback is enough to
 * route Reels to the right format. The roundup format is only ever picked
 * when the caller explicitly passes multiple opportunity items.
 *
 * Routing summary:
 *   - 2+ opportunity items                       → weekly_opportunity_roundup
 *   - scholarship / fellowship / grant / intern  → opportunity_alert
 *   - Haiti-tagged news / histoire / society     → haiti_explainer
 *   - everything else (best fit)                 → haiti_explainer
 */

import type { ReelFormat } from "./types.js";

export interface ClassifyReelFormatInput {
  /** Editorial category (e.g. "scholarship", "bourses", "news", "histoire"). */
  category?: string;
  /** Vertical (e.g. "opportunites", "bourses", "haiti", "world"). */
  vertical?: string;
  /** Optional title (used only as a keyword-fallback signal). */
  title?: string;
  /** Optional summary. Same fallback role as title. */
  summary?: string;
  /** Country tags (e.g. ["ht"]) when available. */
  countries?: string[];
  /**
   * Number of distinct opportunity-eligible items the caller is bundling.
   * When ≥ 2, the result is forced to `weekly_opportunity_roundup`.
   */
  opportunityBundleSize?: number;
}

const OPPORTUNITY_CATEGORIES = new Set([
  "scholarship",
  "bourses",
  "fellowship",
  "fellowships",
  "grant",
  "grants",
  "internship",
  "internships",
  "stages",
  "concours",
  "programmes",
  "opportunity",
  "opportunities",
]);

const OPPORTUNITY_VERTICALS = new Set([
  "opportunites",
  "opportunities",
  "bourses",
  "scholarships",
]);

const HAITI_VERTICALS = new Set([
  "haiti",
  "histoire",
  "education",
  "society",
  "diaspora",
  "youth",
  "policy",
  "economy",
  "security",
]);

const OPPORTUNITY_KEYWORDS = [
  "scholarship",
  "bourse",
  "fellowship",
  "stage",
  "internship",
  "grant",
  "deadline",
  "date limite",
  "apply",
  "application",
  "candidature",
  "postuler",
];

export function classifyReelFormat(input: ClassifyReelFormatInput): ReelFormat {
  if ((input.opportunityBundleSize ?? 0) >= 2) {
    return "weekly_opportunity_roundup";
  }

  const cat = (input.category ?? "").toLowerCase().trim();
  const vert = (input.vertical ?? "").toLowerCase().trim();

  if (OPPORTUNITY_CATEGORIES.has(cat) || OPPORTUNITY_VERTICALS.has(vert)) {
    return "opportunity_alert";
  }

  const haystack = `${input.title ?? ""} ${input.summary ?? ""}`.toLowerCase();
  if (OPPORTUNITY_KEYWORDS.some((k) => haystack.includes(k))) {
    return "opportunity_alert";
  }

  if (HAITI_VERTICALS.has(vert) || (input.countries ?? []).includes("ht")) {
    return "haiti_explainer";
  }

  // Default — Haiti-explainer is the safer narrator-friendly format.
  return "haiti_explainer";
}
