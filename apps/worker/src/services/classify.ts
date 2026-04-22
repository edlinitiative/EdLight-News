/**
 * Deterministic rule-based classifier for opportunity-type items.
 *
 * Runs BEFORE / ALONGSIDE the LLM (Gemini) classifier to ensure
 * scholarship, internship, contest, and programme content reliably
 * lands in the Opportunités vertical with the correct subcategory.
 *
 * Also extracts deadline dates (French + numeric patterns) and sets
 * qualityFlags.missingDeadline when no deadline is found.
 */

import type { GeoTag, ItemCategory, Opportunity } from "@edlight-news/types";

// ── Keyword lists ────────────────────────────────────────────────────────────

const BOURSES_KEYWORDS = [
  "bourse",
  "scholarship",
  "fellowship",
  "grant",
  "financement",
  "tuition",
  "prise en charge",
];

const STAGES_KEYWORDS = [
  "stage",
  "internship",
  "alternance",
];

const CONCOURS_KEYWORDS = [
  "concours",
  "competition",
  "hackathon",
];

const PROGRAMMES_KEYWORDS = [
  "programme",
  "bootcamp",
  "formation",
  "cohorte",
  "admission",
  "appel a candidatures",
  "appel à candidatures",
];

/**
 * Multi-word phrases that strongly indicate a success / inspiration story.
 * Checked via simple substring matching (safe because they are long enough
 * to avoid false positives).
 */
const SUCCESS_PHRASES = [
  // French
  "parcours inspirant", "histoire inspirante", "modele de reussite",
  "parcours exemplaire", "haitien qui brille", "haitienne qui brille",
  "diplome obtenu", "histoire de reussite",
  // English
  "success story", "award-winning",
];

/**
 * Shorter keywords that indicate success BUT require word-boundary
 * matching (\b) to avoid false positives like "one" in "someone".
 * All entries are already accent-stripped for NFD-normalized text.
 */
const SUCCESS_WORDS = [
  // French (accent-stripped forms)
  "reussite", "accomplissement", "laureat",
  "medaille", "palmares", "remporte",
  // Kreyòl Ayisyen (accent-stripped forms)
  "sikse", "reyisit", "akonplisman", "chanpyon",
  // English
  "achievement",
];

/** Pre-compiled word-boundary regex for success words. */
const SUCCESS_WORDS_RE = new RegExp(
  SUCCESS_WORDS.map((w) => `\\b${w}\\b`).join("|"),
  "i",
);

/** Check whether text signals a success / inspiration story. */
function matchesSuccessSignal(normalizedText: string): boolean {
  // 1. Multi-word phrase substring match (cheap, no false-positive risk)
  for (const phrase of SUCCESS_PHRASES) {
    if (normalizedText.includes(normalizeText(phrase))) return true;
  }
  // 2. Single-word boundary match (avoids partial hits)
  return SUCCESS_WORDS_RE.test(normalizedText);
}

// ── Word-boundary matching (prevents substring false positives) ─────────

/** Pre-compile word-boundary regexes for a keyword list. */
function buildWBRegexes(keywords: readonly string[]): RegExp[] {
  return keywords.map((kw) => {
    const norm = normalizeText(kw);
    const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Multi-word phrases: match literally (spaces act as natural boundaries)
    if (kw.includes(" ")) return new RegExp(escaped);
    // Single words: require word boundary on both sides
    return new RegExp(`\\b${escaped}\\b`);
  });
}

function matchesAnyWB(text: string, regexes: readonly RegExp[]): boolean {
  return regexes.some((re) => re.test(text));
}

// Pre-compiled word-boundary regexes for subcategory keyword sets
const BOURSES_WB = buildWBRegexes(BOURSES_KEYWORDS);
const STAGES_WB = buildWBRegexes(STAGES_KEYWORDS);
const CONCOURS_WB = buildWBRegexes(CONCOURS_KEYWORDS);
const PROGRAMMES_WB = buildWBRegexes(PROGRAMMES_KEYWORDS);

/**
 * Conservative opportunity gate keywords.
 *
 * Only high-confidence indicators that rarely appear in general news.
 * Deliberately excludes ambiguous words common in Haitian news context:
 *   ✗ "programme"   → "programme politique", "programme du gouvernement"
 *   ✗ "formation"   → "formation militaire", "formation du gouvernement"
 *   ✗ "prix"        → commodity prices, exchange rates
 *   ✗ "award"       → general recognition
 *   ✗ "competition" → generic usage in non-opportunity contexts
 *   ✗ "cohorte"     → medical / demographic usage
 *   ✗ "admission"   → political admission / acknowledgement
 */
const OPPORTUNITY_GATE_KW = [
  // Scholarships / funding
  "bourse", "scholarship", "fellowship", "financement", "tuition", "prise en charge",
  // Internships
  "stage", "internship", "alternance",
  // Competitions (high-signal only)
  "concours", "hackathon",
  // Admissions / registration
  "inscription", "candidature", "appel a candidatures",
  // Academic programmes (specific degree types)
  "master", "licence", "doctorat", "bootcamp",
  // Application actions
  "postuler", "deadline", "date limite",
  // Generic opportunity
  "opportunit",
  // Haitian Creole
  "okazyon", "bous", "estaj", "konkou",
] as const;
const OPPORTUNITY_GATE_RE = buildWBRegexes(OPPORTUNITY_GATE_KW);

// ── Stock-market disambiguation ──────────────────────────────────────────────
//
// "Bourse" in French is ambiguous: it means BOTH "scholarship" (bourse d'études)
// AND "stock exchange" (la Bourse de Paris, en Bourse, introduction en Bourse).
// Without disambiguation, a finance article like "La Bourse de New York chute"
// gets classified as a scholarship and surfaces on Facebook with the hook
// "Bourse à surveiller" — which is wrong and embarrassing.
//
// The keyword lists below are matched against accent-stripped, lowercased text
// (see `normalizeText`) so they must already be in that form.

const STOCK_MARKET_KEYWORDS = [
  // Named exchanges (FR + EN)
  "bourse de new york", "bourse de paris", "bourse de tokyo",
  "bourse de londres", "bourse de hong kong", "bourse de shanghai",
  "bourse de toronto", "bourse de francfort",
  "wall street", "nasdaq", "nyse", "dow jones", "s&p 500", "s & p 500",
  "cac 40", "ftse", "nikkei", "hang seng", "euronext",
  // Market vocabulary (FR)
  "marche boursier", "marches boursiers", "place boursiere", "places boursieres",
  "indice boursier", "indices boursiers", "valeur boursiere", "valeurs boursieres",
  "capitalisation boursiere", "introduction en bourse", "entree en bourse",
  "cotation", "cotee en bourse", "cote en bourse", "actionnaire", "actionnaires",
  "obligataire", "obligation d'etat", "matieres premieres",
  // Market vocabulary (EN)
  "stock market", "stock exchange", "stock price", "share price",
  "shares fell", "shares rose", "shares jumped", "ipo", "listed company",
] as const;

const SCHOLARSHIP_CONFIRMATION_KEYWORDS = [
  // Direct scholarship phrases (accent-stripped)
  "bourse d'etud", "bourse d etud", "bourses d'etud", "bourses d etud",
  "bourse de merite", "bourse de recherche", "bourse complete",
  "bourse partielle", "bourse doctorale", "bourse universitaire",
  "bourse fulbright", "bourse erasmus", "bourse chevening",
  "boursier", "boursiere", "boursiers", "boursieres",
  // Application / eligibility context
  "candidat", "candidature", "postuler", "appel a candidatures",
  "deadline", "date limite", "eligibilit", "dossier de candidature",
  // Academic context that disambiguates
  "etudiant", "etudiante", "etudiants", "etudiantes",
  "universite", "universites", "faculte", "diplom",
  "master", "licence", "doctorat", "phd", "fellowship", "scholarship",
  "tuition", "frais de scolarite", "prise en charge", "financement d'etud",
  // Well-known scholarship programmes
  "fulbright", "chevening", "erasmus", "daad", "mext",
] as const;

function looksLikeStockMarket(normalizedText: string): boolean {
  return STOCK_MARKET_KEYWORDS.some((kw) => normalizedText.includes(kw));
}

function hasScholarshipContext(normalizedText: string): boolean {
  return SCHOLARSHIP_CONFIRMATION_KEYWORDS.some((kw) =>
    normalizedText.includes(kw),
  );
}

/**
 * Public disambiguation helper for re-classifying historical items.
 *
 * Returns true when the given (raw, un-normalised) text reads like
 * stock-market coverage and lacks any scholarship-specific context —
 * i.e. when a "bourses" classification is almost certainly a false
 * positive caused by the FR/EN ambiguity of the word "bourse".
 */
export function isStockMarketFalsePositive(text: string): boolean {
  const normalized = normalizeText(text);
  return looksLikeStockMarket(normalized) && !hasScholarshipContext(normalized);
}

const HAITI_ENTITIES = [
  "haiti",
  "haïti",
  "ayiti",
  "port-au-prince",
  "cap-haïtien",
  "cap-haitien",
  "les cayes",
  "gonaïves",
  "jacmel",
  "jérémie",
  "hinche",
  "mirebalais",
  "pétion-ville",
  "petionville",
  "delmas",
  "carrefour",
  "cité soleil",
  "menfp",
  "ueh",
  "uniq",
];

// ── Text normalisation ───────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsAny(normalizedText: string, keywords: string[]): boolean {
  return keywords.some((kw) => normalizedText.includes(normalizeText(kw)));
}

// ── Deadline extraction ──────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
};

/** ISO date: 2026-03-15 */
const ISO_DATE_RE = /(\d{4})-(\d{2})-(\d{2})/g;

/** French date: 15 mars 2026 */
const FRENCH_DATE_RE =
  /(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/gi;

/** Numeric date: 15/03/2026 or 15-03-2026 */
const NUMERIC_DATE_RE = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/g;

/** Minimum year we consider valid for upcoming deadlines. */
const MIN_YEAR = new Date().getFullYear();

function extractDeadline(text: string): string | null {
  // 1. ISO dates
  for (const m of text.matchAll(ISO_DATE_RE)) {
    const [, y, mo, d] = m;
    const parsed = new Date(`${y}-${mo}-${d}`);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= MIN_YEAR) {
      return `${y}-${mo}-${d}`;
    }
  }

  // 2. French dates (accent-stripped for matching)
  const stripped = normalizeText(text);
  for (const m of stripped.matchAll(FRENCH_DATE_RE)) {
    const [, day, month, year] = m;
    const mo = MONTH_MAP[month!];
    if (mo && parseInt(year!) >= MIN_YEAR) {
      return `${year}-${mo}-${day!.padStart(2, "0")}`;
    }
  }

  // 3. Numeric dates (assume DD/MM/YYYY — French convention)
  for (const m of text.matchAll(NUMERIC_DATE_RE)) {
    const [, p1, p2, p3] = m;
    const year = parseInt(p3!);
    if (year >= MIN_YEAR) {
      const day = p1!.padStart(2, "0");
      const month = p2!.padStart(2, "0");
      if (parseInt(month) >= 1 && parseInt(month) <= 12) {
        return `${p3}-${month}-${day}`;
      }
    }
  }

  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface ClassificationResult {
  /** Whether the item was identified as an opportunity. */
  isOpportunity: boolean;
  /** Subcategory: bourses | concours | stages | programmes (only when isOpportunity). */
  category?: ItemCategory;
  /** High-level vertical — "opportunites" for opportunity items. */
  vertical?: string;
  /** ISO deadline date (YYYY-MM-DD) or null. */
  deadline?: string | null;
  /** True when no deadline could be extracted from the text. */
  missingDeadline?: boolean;
  /** Geo tag inferred from Haiti entity presence. */
  geoTag?: GeoTag;
  /** Structured opportunity payload for Firestore. */
  opportunity?: Opportunity;
  /** Whether the item is a success / achievement / inspiration story. */
  isSuccessStory: boolean;
}

/**
 * Run the deterministic opportunity classifier on item text.
 *
 * @param title   Article title
 * @param summary Article summary / description
 * @param body    Full article body (extracted text). May be empty.
 */
export function classifyItem(
  title: string,
  summary: string,
  body: string,
): ClassificationResult {
  const combinedText = normalizeText(`${title} ${summary} ${body}`);

  // ── Success story detection (runs for ALL items) ──────────────────────
  const isSuccessStory = matchesSuccessSignal(combinedText);

  // ── Quick exit if no high-confidence opportunity signal ────────────────
  // Uses a conservative gate with word-boundary regex to prevent general
  // news articles from being misclassified as opportunities.
  if (!matchesAnyWB(combinedText, OPPORTUNITY_GATE_RE)) {
    return { isOpportunity: false, isSuccessStory };
  }

  // ── Determine subcategory (priority order: Bourses > Stages > Concours > Programmes) ──
  // Uses word-boundary matching to prevent substring false positives
  // (e.g. "formation" inside "informations").
  let category: ItemCategory;
  if (matchesAnyWB(combinedText, BOURSES_WB)) {
    category = "bourses";
  } else if (matchesAnyWB(combinedText, STAGES_WB)) {
    category = "stages";
  } else if (matchesAnyWB(combinedText, CONCOURS_WB)) {
    category = "concours";
  } else {
    category = "programmes";
  }

  // ── Disambiguate "bourses" vs stock-market false positives ────────────
  // "Bourse" in French = both "scholarship" AND "stock exchange". A finance
  // article like "La Bourse de New York chute" would otherwise be tagged as
  // a scholarship and surface on Facebook with "Bourse à surveiller".
  //
  // Rule: if the text reads like stock-market coverage AND has no
  // scholarship-specific context, drop the opportunity classification.
  if (category === "bourses") {
    const isStockMarket = looksLikeStockMarket(combinedText);
    const hasScholarship = hasScholarshipContext(combinedText);
    if (isStockMarket && !hasScholarship) {
      console.warn(
        `[classify] Skipped "bourses" classification — text looks like stock-market coverage. ` +
          `Title: "${title.slice(0, 80)}"`,
      );
      return { isOpportunity: false, isSuccessStory };
    }
  }

  // ── Extract deadline ──────────────────────────────────────────────────
  const rawText = `${title} ${summary} ${body}`;
  const deadline = extractDeadline(rawText);
  const missingDeadline = !deadline;

  // ── Geo tag ───────────────────────────────────────────────────────────
  const haitiPresent = containsAny(combinedText, HAITI_ENTITIES);
  const geoTag: GeoTag = haitiPresent ? "HT" : "Global";

  // ── Opportunity struct ────────────────────────────────────────────────
  const opportunity: Opportunity = {
    ...(deadline ? { deadline } : {}),
  };

  return {
    isOpportunity: true,
    category,
    vertical: "opportunites",
    deadline,
    missingDeadline,
    geoTag,
    opportunity,
    isSuccessStory,
  };
}
