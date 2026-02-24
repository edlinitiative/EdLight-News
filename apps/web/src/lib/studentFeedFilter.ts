/**
 * Deterministic "Fil étudiant" filter — v2 (tightened crime/security rules).
 *
 * Decides whether a given article should appear in the student-first
 * feed based on keyword blocklists, allowlists, and hard category rules.
 *
 * Design goals:
 *   - No LLM judgement — purely keyword / metadata based.
 *   - No Firestore schema changes — operates on fields already available
 *     on enriched FeedItems.
 *   - Two-tier blocking:
 *       HARD BLOCK  – crime/violence: must have education-impact exception.
 *       SOFT BLOCK  – politics/disaster: education OR opportunity allowlist suffices.
 */

// ── Keyword lists ───────────────────────────────────────────────────────────

/**
 * HARD crime / violence / security keywords.
 * If any of these appear, the article is blocked UNLESS an education-impact
 * exception keyword also appears (the generic opportunity allowlist is NOT
 * enough on its own).
 */
const HARD_CRIME: readonly string[] = [
  "kidnapping",
  "enlevement",
  "enlèvement",
  "ranson",
  "rançon",
  "otage",
  "fusillade",
  "tire",
  "tiré",
  "tuer",
  "tué",
  "meurtre",
  "assassinat",
  "gang",
  "bandi",
  "arme",
  "armes",
  "balle",
  "police",
  "attaque",
  "massacre",
  "viol",
  "incendie criminel",
  // Carried from v1
  "mort",
  "explosion",
  // v3 additions — tighter crime/security net
  "abattu",
  "violence",
  "agression",
  "criminel",
  "insecurite",
  "insécurité",
  "cadavre",
  "braquage",
  "arrestation",
];

/**
 * Education-impact keywords — these can override HARD_CRIME because
 * the article is explicitly about the effect on schools / exams / students.
 *
 * Generic location-only words (école, université, campus, ueh) are included
 * but subject to a safety-valve: when they are the *only* matches and
 * HARD_CRIME also fires, the article is still blocked (the entity is likely
 * just a crime *location*, not the *subject*).
 */
const EDUCATION_IMPACT: readonly string[] = [
  // Institutions & regulatory
  "menfp",
  "ministere de l'education",
  "ministère de l'éducation",
  // Exams & calendar
  "examen",
  "examens",
  "bac",
  "ns4",
  "rentrée",
  "rentree",
  "calendrier scolaire",
  // Operational disruption (compound phrases)
  "cours suspendus",
  "cours repris",
  "fermeture des ecoles",
  "fermeture des écoles",
  "report des examens",
  "reporté",
  "reporte",
  "postponed",
  "classes",
  "enseignant",
  "enseignants",
  "scolaire",
  "education",
  "etudiant",
  // Compound closure phrases for institutions
  "universite fermee",
  "université fermée",
  "ecole fermee",
  "école fermée",
  "campus ferme",
  "campus fermé",
  // Generic education entities (kept; see safety-valve note above)
  "ecole",
  "école",
  "universite",
  "université",
  "ueh",
  "campus",
];

/**
 * Standalone generic-location education words.
 * When these are the ONLY education-impact matches alongside HARD_CRIME,
 * we still block — they likely mark a crime *location*, not an education focus.
 */
const GENERIC_EDUCATION_LOCATIONS = new Set<string>([
  "ecole",
  "universite",
  "campus",
  "ueh",
  "education",
  "etudiant",
]);

/**
 * Politics keywords (soft block).
 * Blocked unless education OR opportunity allowlist also matches.
 */
const BLOCKLIST_POLITICS: readonly string[] = [
  "elections",
  "élections",
  "parlement",
  "coalition",
  "parti",
  "president",
  "président",
  "premier ministre",
  "manifestation",
  "crise politique",
  // v3 additions
  "corruption",
  "conseil des ministres",
  "conseil presidentiel",
  "conseil présidentiel",
  "pacte national",
  "gouvernement",
];

/**
 * Disaster keywords (soft block).
 * Blocked unless education-impact OR opportunity allowlist also matches.
 */
const BLOCKLIST_DISASTER: readonly string[] = [
  "seisme",
  "séisme",
  "ouragan",
  "cyclone",
  "inondation",
  "catastrophe",
  "disaster",
];

/**
 * Positive education / opportunity allowlist.
 * Overrides SOFT blocks (politics, disaster) but NOT hard-crime on its own.
 */
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
  "carriere",
  "career",
  "emploi",
  "apprenticeship",
  "compétences",
  "competences",
  "skills",
  "examen",
  "bac",
  "menfp",
  "ueh",
  // v3 additions — positive student-relevance signals
  "education",
  "éducation",
  "etudiant",
  "étudiant",
  "recherche",
  "diplome",
  "diplôme",
];

// ── Categories that are always allowed ──────────────────────────────────────

const ALWAYS_ALLOW_CATEGORIES = new Set<string>([
  "bourses",
  "opportunités",
  "opportunites",
  "ressources",
  "parcours",
  "universités",
  "universites",
  "calendrier",
  // English-style categories used internally
  "scholarship",
  "opportunity",
  "resource",
  "concours",
  "stages",
  "programmes",
]);

/**
 * Categories considered "general news" — articles in these categories
 * (or with no category) must contain at least one positive student-relevance
 * signal (ALLOWLIST or EDUCATION_IMPACT keyword) to appear in the student feed.
 */
const GENERAL_NEWS_CATEGORIES = new Set<string>([
  "news",
  "local_news",
  "actualites",
  "actualités",
  "haiti",
  "haïti",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Escape special regex characters. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

/**
 * Check if a keyword appears in the haystack with proper boundaries.
 * Multi-word phrases use substring matching; single words use `\b` to avoid
 * partial-word false positives (e.g. "arme" must not match inside "programme").
 */
function keywordMatch(haystack: string, normalizedKw: string): boolean {
  if (normalizedKw.includes(" ")) {
    return haystack.includes(normalizedKw);
  }
  // Allow common French suffixes: -e, -s, -es, -ee, -ees
  // e.g. "tué"→"tue" matches "tuée"→"tuee"; "gang" matches "gangs"
  return new RegExp(`\\b${escapeRegex(normalizedKw)}(?:e?e?s?)?\\b`).test(haystack);
}

/** Count how many keywords from `list` appear in `text`. */
function countHits(text: string, list: readonly string[]): number {
  let hits = 0;
  for (const kw of list) {
    if (keywordMatch(text, normalize(kw))) hits++;
  }
  return hits;
}

/** Return the set of normalized keywords from `list` that matched in `text`. */
function getMatches(text: string, list: readonly string[]): Set<string> {
  const matched = new Set<string>();
  for (const kw of list) {
    const nk = normalize(kw);
    if (keywordMatch(text, nk)) matched.add(nk);
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
  vertical?: string;
  itemType?: string;
}

/**
 * Returns `true` when the article should appear in the student feed.
 *
 * Decision logic (two-tier):
 *
 * 1. **Hard-allow categories** (Bourses, Opportunités, …) → always pass.
 * 2. Build searchable text from title + summary + tags + publisher.
 *    (geoLabel excluded — "Haiti" alone must not act as an allow signal.)
 * 3. **HARD BLOCK — crime / violence:**
 *    Block if any HARD_CRIME keyword hit UNLESS education-impact keywords
 *    also appear (generic location words alone don't count — safety valve).
 * 4. **SOFT BLOCK — politics:**
 *    Block if politics keyword hit UNLESS education/opportunity allowlist hit.
 * 5. **SOFT BLOCK — disaster:**
 *    Block if disaster keyword hit UNLESS education-impact OR allowlist hit.
 * 6. **Default** → allow (general news without blocklist words passes through).
 */
export function isAllowedInStudentFeed(input: StudentFilterInput): boolean {
  const { title, summary, category, tags, publisher, vertical, itemType } = input;

  // ── 1. Hard-allow categories / verticals / utility items ────────────
  const normCat = (category ?? "").toLowerCase().trim();
  if (normCat && ALWAYS_ALLOW_CATEGORIES.has(normCat)) {
    return true;
  }
  const normVertical = (vertical ?? "").toLowerCase().trim();
  if (normVertical && ALWAYS_ALLOW_CATEGORIES.has(normVertical)) {
    return true;
  }
  // Utility items are explicitly student-focused content
  if (itemType === "utility") {
    return true;
  }

  // ── 2. Build searchable text ──────────────────────────────────────────
  //    geoLabel deliberately excluded — "Haiti" tag alone must not allow.
  const parts = [title, summary ?? "", ...(tags ?? []), publisher ?? ""];
  const haystack = normalize(parts.join(" "));

  // ── 3. Count / match ──────────────────────────────────────────────────
  const crimeHits = countHits(haystack, HARD_CRIME);
  const educationMatches = getMatches(haystack, EDUCATION_IMPACT);
  const educationHits = educationMatches.size;
  const politicsHits = countHits(haystack, BLOCKLIST_POLITICS);
  const disasterHits = countHits(haystack, BLOCKLIST_DISASTER);
  const allowlistHits = countHits(haystack, ALLOWLIST);

  // Helper: education-impact is "real" (not just a generic location mention)
  const hasRealEducationImpact = (): boolean => {
    if (educationHits === 0) return false;
    // If any matched keyword is NOT a generic-location word → real impact
    for (const m of educationMatches) {
      if (!GENERIC_EDUCATION_LOCATIONS.has(m)) return true;
    }
    // All matches are generic location words — not enough for crime override
    return false;
  };

  let blocked = false;
  let reason = "";

  // ── HARD BLOCK: crime / violence ─────────────────────────────────────
  if (crimeHits >= 1) {
    if (hasRealEducationImpact()) {
      // Education-impact exception — article is about schools/exams despite
      // a crime context.  Allow through.
    } else {
      blocked = true;
      reason = `hard-crime (crimeHits=${crimeHits}, eduHits=${educationHits}, realImpact=false)`;
    }
  }

  // ── SOFT BLOCK: politics ─────────────────────────────────────────────
  if (!blocked && politicsHits >= 1) {
    if (allowlistHits >= 1 || educationHits >= 1) {
      // Education or opportunity context present → allow
    } else {
      blocked = true;
      reason = `politics (politicsHits=${politicsHits}, allowHits=${allowlistHits}, eduHits=${educationHits})`;
    }
  }

  // ── SOFT BLOCK: disaster ─────────────────────────────────────────────
  if (!blocked && disasterHits >= 1) {
    if (educationHits >= 1 || allowlistHits >= 1) {
      // Education-impact or opportunity context → allow
    } else {
      blocked = true;
      reason = `disaster (disasterHits=${disasterHits}, eduHits=${educationHits}, allowHits=${allowlistHits})`;
    }
  }

  // ── POSITIVE SIGNAL: general news requires student-relevance ─────────
  // Articles in news / local_news / uncategorised must contain at least
  // one ALLOWLIST or EDUCATION_IMPACT keyword to appear in student feed.
  if (!blocked) {
    const isGeneralNews =
      !normCat || GENERAL_NEWS_CATEGORIES.has(normCat);
    if (isGeneralNews && allowlistHits === 0 && educationHits === 0) {
      blocked = true;
      reason = `general-news-no-student-signal (cat="${normCat}")`;
    }
  }

  // ── Dev logging ────────────────────────────────────────────────────────
  if (blocked && process.env.NODE_ENV === "development") {
    console.debug(
      `[StudentFilter] BLOCKED: "${title.slice(0, 80)}" — ${reason}`,
    );
  }

  return !blocked;
}
