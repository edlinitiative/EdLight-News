/**
 * @edlight-news/generator — Bourse / Finance disambiguation
 *
 * Single source of truth for the "bourse" word-sense disambiguation
 * (FR: "bourse" = BOTH "scholarship" AND "stock exchange"). Used by:
 *
 *   - apps/worker/src/services/classify.ts        (deterministic classifier)
 *   - apps/worker/src/jobs/buildFbQueue.ts        (FB composer runtime guard)
 *   - packages/generator/src/validate-classification.ts (LLM post-validator)
 *   - apps/worker/src/scripts/backfill*.ts        (historical cleanup scripts)
 *
 * Centralising avoids the rule-drift bug we caught in commit 7680c81 where
 * stale "boursier(s)" stems in one copy hid stock-market false positives.
 *
 * All keyword arrays are LOWERCASED + ACCENT-STRIPPED. Inputs MUST be
 * passed through `normalizeText()` (or equivalent) before matching.
 */

/**
 * Strip accents and lowercase. Mirrors apps/worker/src/services/classify.ts
 * so the helpers in this module can be used either with pre-normalised
 * text (faster) or with raw text (when callers don't have a normaliser).
 */
export function normalizeForDisambiguation(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Subset of stock-market keywords that are unambiguous finance tokens —
 * they essentially never appear in genuine scholarship coverage. When any
 * of these are present, the article is finance, period.
 *
 * Stored accent-stripped + lowercased.
 */
export const UNAMBIGUOUS_FINANCE_KEYWORDS = [
  "bourse de new york", "bourse de paris", "bourse de tokyo",
  "bourse de londres", "bourse de hong kong", "bourse de shanghai",
  "bourse de toronto", "bourse de francfort",
  "wall street", "nasdaq", "nyse", "dow jones", "s&p 500", "s & p 500",
  "cac 40", "ftse", "nikkei", "hang seng", "euronext",
  "introduction en bourse", "entree en bourse", "cotee en bourse",
  "cote en bourse", "stock exchange", "stock market",
] as const;

/**
 * Broader stock-market vocabulary. Combined with a "no scholarship context"
 * check below to avoid false positives on legitimate scholarship coverage
 * that happens to mention an actionnaire or cotation in passing.
 *
 * Stored accent-stripped + lowercased.
 */
export const STOCK_MARKET_KEYWORDS = [
  ...UNAMBIGUOUS_FINANCE_KEYWORDS,
  // Market vocabulary (FR)
  "marche boursier", "marches boursiers", "place boursiere", "places boursieres",
  "indice boursier", "indices boursiers", "valeur boursiere", "valeurs boursieres",
  "capitalisation boursiere", "cotation",
  "actionnaire", "actionnaires", "obligataire", "obligation d'etat",
  "matieres premieres",
  // Market vocabulary (EN)
  "stock price", "share price", "shares fell", "shares rose", "shares jumped",
  "ipo", "listed company",
] as const;

/**
 * Phrases that confirm "bourse" really means "scholarship" (not stock market).
 *
 * NOTE: bare "boursier(s)/boursiere(s)" stems are intentionally NOT listed
 * here — they appear in finance ("indices boursiers", "marche boursier",
 * "place boursiere") and would hide stock-market false positives from the
 * disambiguation gate. Genuine scholarship recipients are still captured
 * via "etudiant", "candidat", "fulbright", "bourse d'etud", etc.
 *
 * Stored accent-stripped + lowercased.
 */
export const SCHOLARSHIP_CONFIRMATION_KEYWORDS = [
  // Direct scholarship phrases
  "bourse d'etud", "bourse d etud", "bourses d'etud", "bourses d etud",
  "bourse de merite", "bourse de recherche", "bourse complete",
  "bourse partielle", "bourse doctorale", "bourse universitaire",
  "bourse fulbright", "bourse erasmus", "bourse chevening",
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

/**
 * Strict scholarship-confirmation keywords. A genuine "bourses" item MUST
 * contain at least one of these. They are deliberately narrow: each one is
 * unambiguous on its own — unlike weak signals such as "candidat",
 * "deadline" or "appel" which appear in plenty of non-scholarship contexts
 * (UN succession, military recruitment, political nominations, etc.).
 *
 * Stored accent-stripped + lowercased.
 */
export const STRICT_SCHOLARSHIP_KEYWORDS = [
  // The actual word "bourse" + its stems (covers bourses, boursier, boursiere)
  "bours",
  // English equivalents
  "scholarship", "fellowship",
  // Funding vocabulary
  "tuition", "frais de scolarite", "financement d'etud",
  // Named programmes that are unambiguously academic
  "fulbright", "chevening", "erasmus", "daad", "mext",
  "campus france", "samuel huntington", "mastercard foundation",
  // Strong academic-application phrases
  "bourse d'etud", "bourse de merite", "bourse de recherche",
  "bourse complete", "bourse partielle", "bourse doctorale",
  "appel a candidatures pour bourse", "programme de bourse",
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function looksLikeStockMarket(normalizedText: string): boolean {
  return STOCK_MARKET_KEYWORDS.some((kw) => normalizedText.includes(kw));
}

function hasScholarshipContext(normalizedText: string): boolean {
  return SCHOLARSHIP_CONFIRMATION_KEYWORDS.some((kw) =>
    normalizedText.includes(kw),
  );
}

/**
 * Returns true when text reads like stock-market coverage.
 *
 * - Hard short-circuit: any UNAMBIGUOUS_FINANCE_KEYWORDS hit → finance.
 * - Otherwise: weaker stock-market vocab is only a false positive when no
 *   scholarship context is present.
 *
 * Accepts raw or pre-normalised text — normalises internally.
 */
export function isStockMarketFalsePositive(text: string): boolean {
  const normalized = normalizeForDisambiguation(text);
  if (UNAMBIGUOUS_FINANCE_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return true;
  }
  return looksLikeStockMarket(normalized) && !hasScholarshipContext(normalized);
}

/**
 * Returns true when an item currently classified as a scholarship-like
 * opportunity (bourses, scholarship) does NOT contain any strict
 * scholarship-specific token. Such items are almost always false
 * positives caused by weak signals (candidat, deadline, appel à
 * candidatures for non-academic positions, etc.).
 *
 * Accepts raw or pre-normalised text — normalises internally.
 */
export function lacksScholarshipEvidence(text: string): boolean {
  const normalized = normalizeForDisambiguation(text);
  return !STRICT_SCHOLARSHIP_KEYWORDS.some((kw) => normalized.includes(kw));
}
