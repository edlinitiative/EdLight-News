/**
 * Deterministic "Fil étudiant" filter.
 *
 * Decides whether a given article should appear in the student-first
 * feed based on keyword blocklists, allowlists, and hard category rules.
 *
 * Design goals:
 *   - No LLM judgement — purely keyword / metadata based.
 *   - No Firestore schema changes — operates on fields already available
 *     on enriched FeedItems.
 */

// ── Keyword lists ───────────────────────────────────────────────────────────

/**
 * Crime / violence / security keywords.
 * If these appear WITHOUT any allowlist hit the article is blocked.
 */
const BLOCKLIST_CRIME: readonly string[] = [
  "attaque",
  "fusillade",
  "kidnapping",
  "enlevement",
  "enlèvement",
  "assassinat",
  "meurtre",
  "gang",
  "arme",
  "police",
  "mort",
  "tué",
  "tue",
  "viol",
  "incendie",
  "explosion",
];

/**
 * Pure politics / power-struggle keywords.
 * Blocked unless education-related allowlist keywords also appear.
 */
const BLOCKLIST_POLITICS: readonly string[] = [
  "élections",
  "elections",
  "parti",
  "coalition",
  "président",
  "premier ministre",
  "parlement",
  "sanctions",
  "manifestation",
  "crise politique",
];

/**
 * Disaster-only keywords.
 * Blocked unless the article also contains student-relevant guidance.
 */
const BLOCKLIST_DISASTER: readonly string[] = [
  "séisme",
  "cyclone",
  "inondation",
  "ouragan",
  "catastrophe",
];

/** Combined blocklist (all categories). */
const BLOCKLIST: readonly string[] = [
  ...BLOCKLIST_CRIME,
  ...BLOCKLIST_POLITICS,
  ...BLOCKLIST_DISASTER,
];

/** Education / opportunity keywords — presence overrides most blocklists. */
const ALLOWLIST: readonly string[] = [
  "bourse",
  "scholarship",
  "deadline",
  "admission",
  "inscription",
  "université",
  "universite",
  "campus france",
  "concours",
  "stage",
  "internship",
  "formation",
  "atelier",
  "programme",
  "fellowship",
  "orientation",
  "cv",
  "lettre de motivation",
  "carrière",
  "career",
  "emploi",
  "apprenticeship",
  "compétences",
  "skills",
  "examen",
  "bac",
  "menfp",
  "ueh",
];

// ── Categories that are always allowed ──────────────────────────────────────

const ALWAYS_ALLOW_CATEGORIES = new Set([
  "bourses",
  "opportunités",
  "opportunites",
  "ressources",
  "parcours",
  "universités",
  "universites",
  "calendrier",
  // Also match the English-style categories used internally
  "scholarship",
  "opportunity",
  "resource",
  "concours",
  "stages",
  "programmes",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize text for keyword matching (lowercase, strip accents, collapse whitespace). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Count how many keywords from `list` appear in the normalized `text`. */
function countHits(text: string, list: readonly string[]): number {
  // We also normalize the keywords at match-time so accented keywords
  // still match against the accent-stripped text.
  let hits = 0;
  for (const kw of list) {
    if (text.includes(normalize(kw))) {
      hits++;
    }
  }
  return hits;
}

/** Return the set of allowlist keywords that matched. */
function allowlistMatches(text: string): Set<string> {
  const matched = new Set<string>();
  for (const kw of ALLOWLIST) {
    if (text.includes(normalize(kw))) {
      // Store the *normalized* form so that "université" and "universite"
      // collapse into one entry.
      matched.add(normalize(kw));
    }
  }
  return matched;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface StudentFilterInput {
  title: string;
  summary?: string;
  category?: string;
  tags?: string[];
  publisher?: string;
  geoLabel?: string;
}

/**
 * Returns `true` when the article should appear in the student feed.
 *
 * Decision logic (in order):
 * 1. Hard-allow categories (Bourses, Opportunités, …) → always pass.
 * 2. Build searchable text from title + summary + tags.
 * 3. Count allowlist and blocklist hits.
 * 4. If allowlist ≥ 1 → allow, UNLESS it is only a generic "université"
 *    mention AND crime keywords also hit (to avoid "université attaquée").
 * 5. If blocklist ≥ 1 and allowlist = 0 → block.
 * 6. Otherwise → allow (general news without blocklist words passes through).
 */
export function isAllowedInStudentFeed(input: StudentFilterInput): boolean {
  const { title, summary, category, tags, publisher, geoLabel } = input;

  // ── 1. Hard-allow categories ──────────────────────────────────────────
  const normCat = (category ?? "").toLowerCase().trim();
  if (normCat && ALWAYS_ALLOW_CATEGORIES.has(normCat)) {
    return true;
  }

  // ── 2. Build searchable text ──────────────────────────────────────────
  const parts = [title, summary ?? "", ...(tags ?? []), publisher ?? "", geoLabel ?? ""];
  const haystack = normalize(parts.join(" "));

  // ── 3. Count hits ─────────────────────────────────────────────────────
  const alMatches = allowlistMatches(haystack);
  const alHits = alMatches.size;
  const blCrimeHits = countHits(haystack, BLOCKLIST_CRIME);
  const blPoliticsHits = countHits(haystack, BLOCKLIST_POLITICS);
  const blDisasterHits = countHits(haystack, BLOCKLIST_DISASTER);
  const blTotal = blCrimeHits + blPoliticsHits + blDisasterHits;

  // ── 4. Allowlist override (with crime safety valve) ───────────────────
  if (alHits >= 1) {
    // Safety valve: if the ONLY allowlist match is a generic "université"
    // mention AND there are crime keyword hits, still block.
    const onlyGenericUni =
      alHits === 1 && alMatches.has("universite");
    if (onlyGenericUni && blCrimeHits >= 1) {
      return false;
    }
    return true;
  }

  // ── 5. Blocklist blocks when no allowlist offset ──────────────────────
  if (blTotal >= 1) {
    return false;
  }

  // ── 6. Default: allow ─────────────────────────────────────────────────
  return true;
}
