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
] as const;
