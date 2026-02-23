/**
 * Shared constants for scholarship filter search-params.
 *
 * Kept in a plain module (no "use client") so both the server page
 * component and the client BoursesFilters component can import it.
 */

export const FILTER_PARAM_KEYS = [
  "funding",
  "level",
  "country",
  "eligibility",
  "type",
  "sort",
] as const;
