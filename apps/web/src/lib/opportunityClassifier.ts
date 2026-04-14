/**
 * Deterministic subcategory classifier for Opportunités.
 *
 * Classifies items into one of six subcategories using keyword matching
 * with strict precedence order and confidence scoring.
 *
 * Pure function — no Firestore access, safe for client components.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type OpportunitySubcategory =
  | "Bourses"
  | "Programmes"
  | "Stages"
  | "Concours"
  | "Ressources"
  | "Autre";

export interface ClassifierInput {
  title: string;
  summary?: string;
  body?: string;
  category?: string;
  publisher?: string;
  url?: string;
}

export interface ClassificationResult {
  subcategory: OpportunitySubcategory;
  confidence: "high" | "medium" | "low";
}

// ── Text normalisation ───────────────────────────────────────────────────────

/** Strip accents, lowercase, collapse whitespace. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a single searchable blob from all classifier input fields.
 *  NOTE: `category` is deliberately excluded — including it causes circular
 *  self-confirmation (item has category:"concours" → blob contains "concours"
 *  → classified as Concours). The raw category is only used as a last-resort
 *  fallback at the bottom of classifyOpportunity(). */
function buildBlob(input: ClassifierInput): string {
  return normalise(
    [input.title, input.summary, input.body, input.publisher, input.url]
      .filter(Boolean)
      .join(" "),
  );
}

// ── Keyword sets ─────────────────────────────────────────────────────────────

const BOURSES_KW = [
  // French
  "bourse", "bourses", "financement", "prise en charge", "allocation",
  "subvention", "aide financiere",
  // English
  "scholarship", "scholarships", "fellowship", "grant", "funding",
  "stipend", "bursary", "tuition waiver", "tuition",
  // Named programmes / institutions
  "chevening", "commonwealth", "daad", "erasmus", "auf",
  "mastercard foundation", "fulbright", "rhodes", "gates cambridge",
  "clarendon", "csc", "campus france bourse",
  // Haitian Creole
  "bous",
] as const;

const STAGES_KW = [
  // French
  "stage", "stages", "alternance", "apprentissage",
  "volontariat", "emploi", "recrute", "recrutement",
  "programme de stage", "offre de stage",
  // English
  "internship", "internships", "apprenticeship", "trainee",
  "volunteer", "job", "hiring", "application for internship",
  // Haitian Creole
  "estaj", "travay",
] as const;

/**
 * Admission-priority keywords: subset of programme signals that beat
 * Concours when both are present (e.g. "concours d'admission UEH").
 */
const ADMISSION_PRIORITY_KW = [
  "admission", "admissions", "inscription", "inscriptions",
  "appel a candidatures", "appel a candidature",
  "enrollment", "registration", "s'inscrire",
  // Haitian Creole
  "enskri", "enskipsyon", "admisyon",
  // Institutional signals (imply admissions, not competitions)
  "ueh", "menfp",
] as const;

const PROGRAMMES_KW = [
  // French — admission / registration
  "admission", "admissions", "inscription", "inscriptions",
  "s'inscrire", "candidature", "candidatures",
  "appel a candidatures", "appel a candidature",
  // French — programmes / training
  "programme", "formation", "master", "licence", "doctorat",
  "mba", "bootcamp", "cours", "cohorte", "session", "rentree",
  // English
  "enrollment", "apply to", "application open", "applications open",
  "postuler", "registration", "phd",
  // Haitian Creole
  "enskri", "enskipsyon", "admisyon", "pwogram", "fomasyon",
  "kandida", "aplike",
] as const;

const CONCOURS_KW = [
  "concours", "competition", "hackathon", "prix",
  "award competition", "olympiade", "challenge", "tournoi",
  // Haitian Creole
  "konkou",
] as const;

/** Hard concours signals that win even when admission keywords are present. */
const HARD_CONCOURS_KW = ["hackathon", "prix", "olympiade", "tournoi"] as const;

const RESSOURCES_KW = [
  "guide", "how to", "how-to", "comment faire",
  "plan d'etude", "plan d etude",
  "cv", "lettre de motivation", "entretien",
  "preparer", "tips", "conseils",
  "ressource", "ressources", "template", "modele",
  "checklist", "toolkit", "step by step",
] as const;

// ── Smell test (shared across all badge-rendering surfaces) ──────────────────

/**
 * Curated keyword list for quick opportunity detection.
 *
 * Only **high-confidence** indicators — avoids ambiguous words that
 * commonly appear in general news (crime, politics, finance):
 *   ✗ "programme" → "programme politique", "programme du gouvernement"
 *   ✗ "formation" → substring of "informations", "formation militaire"
 *   ✗ "prix"      → "prix des produits" (commodity price), not award
 *   ✗ "aide"      → "aide humanitaire", "aide internationale"
 *   ✗ "emploi"    → general employment discussion
 *   ✗ "recrutement" → gang / military recruitment warnings
 *   ✗ "etudiant"  → articles *about* students vs *for* students
 *   ✗ "financement" / "subvention" / "allocation" → general govt spending
 *
 * Word-boundary regex (`\b`) prevents substring false positives
 * (e.g. "formation" inside "informations").
 */
const SMELL_REGEXES: RegExp[] = (() => {
  const keywords = [
    // ── Scholarships / funding ──
    "bourse", "bourses", "scholarship", "fellowship", "bursary", "stipend",
    // ── Internships / training ──
    "stage", "stages", "internship", "alternance", "apprentissage",
    // ── Academic admissions ──
    "inscription", "inscriptions", "admission", "admissions",
    "candidature", "candidatures",
    // ── Academic programs (specific enough with word boundary) ──
    "master", "licence", "doctorat", "diplome", "mba", "bootcamp",
    // ── Competitions ──
    "concours", "hackathon", "olympiade",
    // ── Application actions ──
    // NOTE: "deadline", "date limite", "cloture" removed — too ambiguous as
    // standalone signals (government deadlines, parliamentary closures, etc.).
    "postuler",
    // ── Academic context ──
    "universitaire", "university",
    // ── Opportunity generic ──
    "opportunit",
    // ── Haitian Creole ──
    "okazyon", "bous", "estaj", "konkou",
  ];
  return keywords.map((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Multi-word phrases: match literally (word boundaries implied by spaces)
    if (kw.includes(" ")) return new RegExp(escaped);
    // Single words: require word boundary on both sides
    return new RegExp(`\\b${escaped}\\b`);
  });
})();

/**
 * Negative-signal regex: if these match, the article is almost certainly
 * *news about* a subject rather than an *opportunity to participate*.
 *
 * Covers:
 *  - Electoral/political context (inscription des *électeurs*, processus *électoral*)
 *  - Winner/result announcements (remporte, lauréat, gagné un concours)
 *  - Crime/security context (assassinat, complot, arrêté, accusé)
 */
const NEGATIVE_RE = /\b(?:electora[l]|electeur|electeurs|scrutin|vote|mandat|depute|parlement|senat(?:eur)?|remporte|laureat|gagne|gagnant|proclam|sacr[e]e?\s+champion|arrestation|assassin|complot|accuse|condamn|gang|armee|militaire|tir|fusillade|enlev|kidnapp)/i;

/**
 * Quick smell test: does the title/summary actually contain opportunity
 * keywords?  Prevents general-news articles with stale opp-adjacent
 * Firestore categories (e.g. crime news with category "concours") from
 * being run through the opportunity classifier.
 *
 * Also rejects articles with negative signals (electoral context, winner
 * announcements, crime reports) even when positive keywords match.
 *
 * Exported so ArticleCard, news-feed CategoryBadge, and the /news/[id]
 * detail page can all share the same logic (DRY).
 */
export function contentLooksLikeOpportunity(
  title: string,
  summary?: string,
): boolean {
  const blob = normalise(`${title} ${summary ?? ""}`);
  if (NEGATIVE_RE.test(blob)) return false;
  return SMELL_REGEXES.some((re) => re.test(blob));
}

// ── Matching helpers ─────────────────────────────────────────────────────────

/**
 * Match a keyword in normalised text.
 * Multi-word phrases: literal `includes` (word boundaries implied by spaces).
 * Single words: word-boundary regex to prevent substring false positives
 * (e.g. "formation" inside "informations").
 */
function kwMatch(text: string, kw: string): boolean {
  if (kw.includes(" ")) return text.includes(kw);
  return new RegExp(`\\b${kw}\\b`).test(text);
}

/** Count how many keywords from the list appear in the text. */
function countMatches(text: string, keywords: readonly string[]): number {
  let count = 0;
  for (const kw of keywords) {
    if (kwMatch(text, kw)) count++;
  }
  return count;
}

/** Check if any keyword from the list appears in the text. */
function hasMatch(text: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => kwMatch(text, kw));
}

// ── Confidence scoring ───────────────────────────────────────────────────────

function confidence(matchCount: number): "high" | "medium" | "low" {
  if (matchCount >= 2) return "high";
  if (matchCount === 1) return "medium";
  return "low";
}

// ── Classifier ───────────────────────────────────────────────────────────────

/**
 * Classify an opportunity into a deterministic subcategory.
 *
 * Precedence:
 *   1. Bourses    — scholarships / funding
 *   2. Stages     — internships / jobs / volunteering
 *   3. Programmes — admissions / inscriptions (beats Concours unless
 *                   hard contest signals like hackathon/prix are present)
 *   4. Concours   — competitions / hackathons
 *   5. Programmes — remaining programme / formation keywords
 *   6. Ressources — guides / how-to
 *   7. Autre      — fallback
 */
export function classifyOpportunity(input: ClassifierInput): ClassificationResult {
  const blob = buildBlob(input);

  const boursesCount = countMatches(blob, BOURSES_KW);
  const stagesCount = countMatches(blob, STAGES_KW);
  const programmesCount = countMatches(blob, PROGRAMMES_KW);
  const concoursCount = countMatches(blob, CONCOURS_KW);
  const ressourcesCount = countMatches(blob, RESSOURCES_KW);

  // ── Priority 1: Bourses ──────────────────────────────────────────────────
  if (boursesCount > 0) {
    return { subcategory: "Bourses", confidence: confidence(boursesCount) };
  }

  // ── Priority 2: Stages ──────────────────────────────────────────────────
  if (stagesCount > 0) {
    return { subcategory: "Stages", confidence: confidence(stagesCount) };
  }

  // ── Priority 3: Admission-priority check ─────────────────────────────────
  // If admission keywords present, Programmes wins UNLESS hard-concours
  // signals (hackathon / prix / olympiade / tournoi) override.
  const hasAdmission = hasMatch(blob, ADMISSION_PRIORITY_KW);
  const hasConcours = concoursCount > 0;

  if (hasAdmission) {
    if (hasConcours && hasMatch(blob, HARD_CONCOURS_KW)) {
      return { subcategory: "Concours", confidence: confidence(concoursCount) };
    }
    return { subcategory: "Programmes", confidence: confidence(programmesCount || 1) };
  }

  // ── Priority 4: Concours (no admission overlap at this point) ────────────
  if (hasConcours) {
    return { subcategory: "Concours", confidence: confidence(concoursCount) };
  }

  // ── Priority 5: Remaining programme keywords ─────────────────────────────
  if (programmesCount > 0) {
    return { subcategory: "Programmes", confidence: confidence(programmesCount) };
  }

  // ── Priority 6: Ressources ──────────────────────────────────────────────
  if (ressourcesCount > 0) {
    return { subcategory: "Ressources", confidence: confidence(ressourcesCount) };
  }

  // ── Fallback: try existing category field ───────────────────────────────
  const cat = normalise(input.category ?? "");
  if (cat === "bourses" || cat === "scholarship") {
    return { subcategory: "Bourses", confidence: "low" };
  }
  if (cat === "stages") {
    return { subcategory: "Stages", confidence: "low" };
  }
  if (cat === "concours") {
    return { subcategory: "Concours", confidence: "low" };
  }
  if (cat === "programmes" || cat === "opportunity") {
    return { subcategory: "Programmes", confidence: "low" };
  }
  if (cat === "resource" || cat === "ressources") {
    return { subcategory: "Ressources", confidence: "low" };
  }

  return { subcategory: "Autre", confidence: "low" };
}
