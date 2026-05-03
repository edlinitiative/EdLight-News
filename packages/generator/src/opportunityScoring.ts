/**
 * @edlight-news/generator — Opportunity scoring & strict per-subcategory gates
 *
 * Single source of truth for deciding whether an article is a real,
 * actionable opportunity (vertical=opportunites) — not just any article
 * that happens to contain a single weak keyword like "stage" or "programme".
 *
 * Used by:
 *   - apps/worker/src/services/classify.ts        (ingest-time gating)
 *   - apps/worker/src/scripts/auditOpportunityMisclassifications.ts
 *   - apps/web/src/app/opportunites/page.tsx      (render-time guard)
 *
 * ## Why per-subcategory STRICT keyword sets?
 *
 * The legacy single-keyword gate fires on common Haitian news vocabulary:
 *   ✗ "À ce stage du processus politique"             → "stage"
 *   ✗ "Le programme du nouveau gouvernement"          → "programme"
 *   ✗ "Formation du conseil présidentiel"             → "formation"
 *   ✗ "Concours général de la fonction publique"      → "concours"
 *   ✗ "Date limite d'inscription électorale"          → "inscription"
 *   ✗ "Appel à candidature pour Premier ministre"     → "candidature"
 *   ✗ "Master plan présidentiel"                      → "master"
 *
 * Each subcategory now requires either:
 *   - a multi-word phrase that's unambiguous on its own
 *     ("offre de stage", "appel à candidatures pour bourse"), OR
 *   - a single keyword PLUS a confirming co-occurrence
 *     ("stage" + "internship/postuler/recrutement/student")
 *
 * ## Score model
 *
 * `scoreOpportunity()` returns 0-100. The caller decides the threshold
 * (current default: 50 in classify.ts). The score is also persisted on
 * the Item (as `opportunityScore`) so the render layer can second-guess
 * legacy items written before the gate existed.
 */

// ── Normalisation ────────────────────────────────────────────────────────────

/** Strip accents + lowercase. */
export function normalizeForOpportunity(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function wb(kw: string): RegExp {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (kw.includes(" ")) return new RegExp(escaped);
  return new RegExp(`\\b${escaped}\\b`);
}

function anyMatch(text: string, regexes: readonly RegExp[]): boolean {
  return regexes.some((re) => re.test(text));
}

// ── Per-subcategory STRICT keyword sets ──────────────────────────────────────

/**
 * STRICT bourses keywords — re-export for symmetry; the canonical list
 * lives in disambiguation.ts to avoid drift with the FB composer.
 */
export { STRICT_SCHOLARSHIP_KEYWORDS } from "./disambiguation.js";

/** Phrases that unambiguously indicate an internship/job posting. */
export const STRICT_STAGES_PHRASES = [
  "offre de stage", "offres de stage", "appel a stagiaires",
  "recrutement de stagiaires", "convention de stage",
  "stage remunere", "stage remuneres", "stage en entreprise",
  "stage de fin d'etudes", "stage de fin d etudes",
  "stage academique", "stage professionnel", "stage diplomant",
  "summer internship", "internship program", "internship programme",
  "internship opportunity", "paid internship", "graduate internship",
  "ofri estaj", "estaj peye",
] as const;

/** Single tokens that need a co-occurring confirming signal. */
export const STAGES_CONFIRMING_KW = [
  "internship", "internships", "stagiaire", "stagiaires",
  "apprenticeship", "apprenti", "apprentis",
  "alternance", "alternant",
  "trainee", "traineeship",
  "postuler", "candidater", "apply", "aplike",
  "recrute", "recrutement", "hiring",
  "etudiant", "etudiants", "etudiante", "etudiantes", "student", "students",
] as const;

/** Phrases that unambiguously indicate a contest open for applications. */
export const STRICT_CONCOURS_PHRASES = [
  "concours d'entree", "concours d entree",
  "concours de recrutement",
  "concours national", "concours international",
  "concours de bourses",
  "appel a candidatures pour le concours",
  "open for applications", "open for entries",
  "hackathon", "ideathon", "datathon",
  "olympiade", "olympiades",
  "prix de l'innovation", "prix de l innovation",
  "prix etudiant", "prix etudiants",
  "konkou bous",
] as const;

/** Single tokens that need a co-occurring confirming signal. */
export const CONCOURS_CONFIRMING_KW = [
  "postuler", "candidater", "apply", "aplike",
  "deadline", "date limite", "cloture", "echeance",
  "etudiant", "etudiants", "etudiante", "etudiantes", "student", "students",
  "lyceen", "lyceens", "universitaire", "universitaires",
  "young professional", "jeunes professionnels", "jeune professionnel",
] as const;

/** Phrases that unambiguously indicate an academic / training programme. */
export const STRICT_PROGRAMMES_PHRASES = [
  "appel a candidatures pour le programme",
  "appel a candidature pour le programme",
  "ouverture des inscriptions", "ouverture des admissions",
  "candidatures ouvertes", "applications open",
  "rentree universitaire", "rentree academique",
  "programme de bourse", "programme de bourses",
  "programme d'echange", "programme d echange",
  "programme de mentorat", "programme de mentor",
  "programme de formation",
  "bootcamp", "boot camp",
  "summer school", "summer program", "summer programme",
  "winter school", "ecole d'ete", "ecole d ete",
  "master de", "licence en", "doctorat en",
  "phd program", "phd programme", "mba program",
  "campus france", "etudier en france",
  "study abroad",
  "pwogram bous", "fomasyon pou etidyan",
] as const;

/** Single tokens that need a co-occurring confirming signal. */
export const PROGRAMMES_CONFIRMING_KW = [
  "postuler", "candidater", "apply", "aplike",
  "admission", "admissions", "inscription", "inscriptions",
  "deadline", "date limite", "cloture",
  "etudiant", "etudiants", "etudiante", "etudiantes", "student", "students",
  "universite", "university", "faculte",
  "lyceen", "lyceens",
] as const;

// Pre-compiled regexes (built once)
const STRICT_STAGES_RE = STRICT_STAGES_PHRASES.map(wb);
const STRICT_CONCOURS_RE = STRICT_CONCOURS_PHRASES.map(wb);
const STRICT_PROGRAMMES_RE = STRICT_PROGRAMMES_PHRASES.map(wb);
const STAGES_CONFIRMING_RE = STAGES_CONFIRMING_KW.map(wb);
const CONCOURS_CONFIRMING_RE = CONCOURS_CONFIRMING_KW.map(wb);
const PROGRAMMES_CONFIRMING_RE = PROGRAMMES_CONFIRMING_KW.map(wb);

const WEAK_STAGES_RE = [/\bstage\b/, /\bstages\b/, /\bestaj\b/];
const WEAK_CONCOURS_RE = [/\bconcours\b/, /\bcompetition\b/, /\bkonkou\b/];
const WEAK_PROGRAMMES_RE = [
  /\bprogramme\b/, /\bprograms?\b/, /\bformation\b/, /\bcohorte\b/,
  /\bmaster\b/, /\blicence\b/, /\bdoctorat\b/, /\bphd\b/, /\bmba\b/,
  /\bpwogram\b/, /\bfomasyon\b/,
];

// ── Negative signal: clearly not an opportunity ──────────────────────────────

/**
 * Patterns that strongly imply the article is news *about* something, not
 * an opportunity to apply to. Mirrors NEGATIVE_RE in
 * apps/web/src/lib/opportunityClassifier.ts but extended for political /
 * institutional vocabulary that surfaces frequently in Haitian coverage.
 */
const NEGATIVE_OPPORTUNITY_RE =
  /\b(?:electora[l]|electeur|electeurs|scrutin|vote|mandat|depute|parlement|senat(?:eur)?|premier\s+ministre|conseil\s+presidentiel|cpt|primature|gouvernement\s+de\s+transition|fonction\s+publique|nominat(?:e|ion)|nomme\s+(?:au|a\s+la|aux)|prete\s+serment|gang|kidnapping|enleve(?:ment)?|assassinat|condamn|arrete|police\s+nationale|pnh|fmi|imf|banque\s+centrale|brh|millions\s+de\s+(?:dollars|gourdes)|inflation|taux\s+de\s+change)/i;

const POLITICAL_NEGATIVE_RE =
  /\b(?:martelly|moise|jovenel|preval|ariel\s+henry|garry\s+conille|alix\s+didier\s+fils[\-\s]?aime|leslie\s+voltaire|laurent\s+saint[\-\s]?cyr|edgard\s+leblanc|fritz\s+belizaire)\b/i;

// ── Action / institution / programme signals ────────────────────────────────

const APPLY_VERB_RE = [
  "postuler", "candidater", "apply now", "apply for",
  "soumettre votre candidature", "soumettre sa candidature",
  "deposer sa candidature", "submit your application",
  "complete the application", "remplir le formulaire",
  "aplike", "soumèt aplikasyon",
].map(wb);

const APPLY_URL_RE = /\bhttps?:\/\/\S*(?:apply|application|candidature|inscription|admission)\S*/i;

/** Named scholarship / programme brands that are unambiguous on their own. */
const NAMED_PROGRAMME_RE = [
  "fulbright", "chevening", "erasmus", "daad", "mext",
  "rhodes", "gates cambridge", "clarendon", "csc",
  "campus france", "samuel huntington", "mastercard foundation",
  "bgf", "auf", "ifi", "francophonie",
  "world bank", "banque mondiale", "iadb", "bid", "undp", "pnud",
  "unesco", "unicef", "ohchr", "carter center",
  "google for startups", "y combinator", "techstars",
].map(wb);

const HAITI_ENTITY_RE = [
  "haiti", "haïti", "ayiti",
  "uniq", "ueh", "menfp",
  "lyceen", "lyceens", "etudiant haitien", "etudiants haitiens",
  "etudiante haitienne", "etudiantes haitiennes",
  "diaspora haitienne",
].map(wb);

// ── Subcategory matching ─────────────────────────────────────────────────────

export type OpportunitySubcategory =
  | "bourses"
  | "stages"
  | "concours"
  | "programmes";

export interface SubcategoryMatch {
  subcategory: OpportunitySubcategory | null;
  /** "strict" = an unambiguous phrase matched; "weak" = single-keyword + confirming token; "none" */
  strength: "strict" | "weak" | "none";
}

/**
 * Determine subcategory using a strict-first, then weak-with-confirmation
 * matcher. Bourses goes through the legacy STRICT_SCHOLARSHIP_KEYWORDS
 * (already enforced in classify.ts via `lacksScholarshipEvidence`).
 */
export function matchSubcategory(normText: string): SubcategoryMatch {
  // Bourses — handled separately by classify.ts using STRICT_SCHOLARSHIP_KEYWORDS
  // We still detect it here so the score model can credit it.
  // Stem-match `bours` (covers bourse, bourses, boursier, boursière) — bare
  // word-boundary on `bours` would miss the most common forms.
  if (/\bbours/.test(normText) || /\bscholarship/.test(normText) || /\bfellowship/.test(normText)) {
    // Intentionally no "weak vs strict" distinction here — classify.ts
    // already enforces the strict scholarship gate.
    return { subcategory: "bourses", strength: "strict" };
  }

  // Stages
  if (anyMatch(normText, STRICT_STAGES_RE)) {
    return { subcategory: "stages", strength: "strict" };
  }
  if (
    anyMatch(normText, WEAK_STAGES_RE) &&
    anyMatch(normText, STAGES_CONFIRMING_RE)
  ) {
    return { subcategory: "stages", strength: "weak" };
  }

  // Concours
  if (anyMatch(normText, STRICT_CONCOURS_RE)) {
    return { subcategory: "concours", strength: "strict" };
  }
  if (
    anyMatch(normText, WEAK_CONCOURS_RE) &&
    anyMatch(normText, CONCOURS_CONFIRMING_RE)
  ) {
    return { subcategory: "concours", strength: "weak" };
  }

  // Programmes
  if (anyMatch(normText, STRICT_PROGRAMMES_RE)) {
    return { subcategory: "programmes", strength: "strict" };
  }
  if (
    anyMatch(normText, WEAK_PROGRAMMES_RE) &&
    anyMatch(normText, PROGRAMMES_CONFIRMING_RE)
  ) {
    return { subcategory: "programmes", strength: "weak" };
  }

  return { subcategory: null, strength: "none" };
}

// ── Score ────────────────────────────────────────────────────────────────────

export interface OpportunityScoreInput {
  title: string;
  summary?: string;
  body?: string;
  /** Worker-extracted deadline (ISO YYYY-MM-DD) if any. */
  deadline?: string | null;
  /** Optional explicit apply URL extracted by the scraper. */
  applyUrl?: string | null;
  /** Publisher name — opportunity-source feeds get a small boost. */
  publisherName?: string | null;
}

export interface OpportunityScoreResult {
  score: number; // 0-100
  subcategory: OpportunitySubcategory | null;
  strength: SubcategoryMatch["strength"];
  reasons: string[];
}

/**
 * Publishers whose feeds are dedicated to opportunities — items from
 * these sources get a confidence boost even if individual articles use
 * unusually casual language.
 */
const OPPORTUNITY_SOURCE_PUBLISHERS = [
  "campus france", "scholarshipportal", "opportunity desk",
  "opportunities for youth", "auf", "francophonie",
  "edlight scholarship radar",
  "ofri opotinite", // hypothetical HT source
  "edlight bourses",
];

/**
 * Score an article on the 0-100 opportunity-confidence scale.
 *
 * Components:
 *   +50  strict subcategory match      (offre de stage, appel pour bourse, …)
 *   +20  weak subcategory match        (single keyword + confirming token)
 *   +20  parsed deadline available
 *   +15  apply verb in text            (postuler / apply for / candidater)
 *   +15  apply URL present
 *   +15  named programme               (Fulbright, Erasmus, Campus France, …)
 *   +10  Haiti entity present
 *   +10  publisher in opportunity feeds
 *   −40  negative signal (electoral / political / financial news)
 *   −25  political-actor name without academic context
 *
 * Cap at 100, floor at 0.
 */
export function scoreOpportunity(
  input: OpportunityScoreInput,
): OpportunityScoreResult {
  const blob = normalizeForOpportunity(
    `${input.title} ${input.summary ?? ""} ${input.body ?? ""}`,
  );
  const reasons: string[] = [];
  let score = 0;

  const sub = matchSubcategory(blob);
  if (sub.strength === "strict") {
    score += 50;
    reasons.push(`+50 strict subcategory match (${sub.subcategory})`);
  } else if (sub.strength === "weak") {
    score += 20;
    reasons.push(`+20 weak subcategory match (${sub.subcategory})`);
  }

  if (input.deadline) {
    score += 20;
    reasons.push("+20 parsed deadline");
  }

  if (anyMatch(blob, APPLY_VERB_RE)) {
    score += 15;
    reasons.push("+15 apply verb");
  }

  const text = `${input.title} ${input.summary ?? ""} ${input.body ?? ""}`;
  if (input.applyUrl || APPLY_URL_RE.test(text)) {
    score += 15;
    reasons.push("+15 apply URL");
  }

  if (anyMatch(blob, NAMED_PROGRAMME_RE)) {
    score += 15;
    reasons.push("+15 named programme");
  }

  if (anyMatch(blob, HAITI_ENTITY_RE)) {
    score += 10;
    reasons.push("+10 Haiti entity");
  }

  if (input.publisherName) {
    const pubNorm = normalizeForOpportunity(input.publisherName);
    if (OPPORTUNITY_SOURCE_PUBLISHERS.some((p) => pubNorm.includes(p))) {
      score += 10;
      reasons.push("+10 opportunity-source publisher");
    }
  }

  if (NEGATIVE_OPPORTUNITY_RE.test(blob)) {
    // Only deduct heavily when no strict subcategory match — institutional
    // scholarship calls *can* legitimately mention the government as the
    // sponsor (e.g. "le programme du gouvernement haïtien finance…").
    if (sub.strength !== "strict") {
      score -= 40;
      reasons.push("-40 negative signal (electoral / political / financial)");
    } else {
      score -= 10;
      reasons.push("-10 negative signal (mitigated by strict match)");
    }
  }

  if (POLITICAL_NEGATIVE_RE.test(blob) && sub.strength !== "strict") {
    score -= 25;
    reasons.push("-25 political-actor name without academic context");
  }

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score,
    subcategory: sub.subcategory,
    strength: sub.strength,
    reasons,
  };
}

/**
 * Default acceptance threshold used by classify.ts and the page guard.
 * Tuned so that:
 *   - A real "Bourse Fulbright pour étudiants haïtiens, deadline 15 mars"
 *     scores ≥ 80
 *   - A weak-keyword news article like "À ce stage du processus politique"
 *     scores < 30
 */
export const OPPORTUNITY_SCORE_THRESHOLD = 50;

/**
 * Convenience wrapper — true when the article should be tagged
 * vertical=opportunites.
 */
export function passesOpportunityGate(input: OpportunityScoreInput): boolean {
  return scoreOpportunity(input).score >= OPPORTUNITY_SCORE_THRESHOLD;
}
