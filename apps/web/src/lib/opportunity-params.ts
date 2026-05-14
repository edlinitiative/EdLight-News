/**
 * Shared constants for opportunity filter search-params.
 *
 * Kept in a plain module (no "use client") so both the server page
 * component and the client OpportunitiesFeed component can import it.
 */

export const OPPORTUNITY_FILTER_PARAM_KEYS = [
  "subcategory",
  "sort",
  "deadline",
  "expired",
  // Wider taxonomy (v3) — fine-grained filters surfaced from
  // Item.opportunity (kind / audience / fundingType). All optional;
  // chips only render when the underlying field is populated.
  "kind",
  "audience",
  "funding",
  "lifecycle",
] as const;
