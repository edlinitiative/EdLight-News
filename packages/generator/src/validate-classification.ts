/**
 * @edlight-news/generator — Classification Post-Validation
 *
 * Catches obviously wrong Gemini category assignments before they reach
 * Firestore.  Uses keyword-based heuristics — no LLM call, no latency cost.
 *
 * Reclassification is logged as a warning so we can track model drift.
 */

// ── Keyword lists ───────────────────────────────────────────────────────────

/** Keywords that strongly signal hard news / breaking events */
const HARD_NEWS_KEYWORDS: readonly string[] = [
  "procès",
  "tribunal",
  "assassinat",
  "meurtre",
  "crime",
  "tremblement",
  "séisme",
  "ouragan",
  "conflit",
  "guerre",
  "élection",
  "gouvernement",
  "politique",
  "accident",
  "tragédie",
  "catastrophe",
  "effondrement",
  "émeute",
  "manifestation",
  "coup d'état",
  "arrestation",
  "kidnapping",
  "violence",
  "gang",
  "police",
  "armée",
  "invasion",
  "attentat",
  "explosion",
  "incendie",
  "inondation",
  "mort",
  "victime",
  "blessé",
] as const;

/** Keywords that strongly signal scholarship / opportunity content */
const OPPORTUNITY_KEYWORDS: readonly string[] = [
  "bourse",
  "scholarship",
  "deadline",
  "date limite",
  "candidature",
  "postuler",
  "fellowship",
  "financement",
  "subvention",
  "appel à candidatures",
  "apply",
  "application",
] as const;

/** Tokens that indicate the content is about Haiti specifically */
const HAITI_LOCALE_TOKENS: readonly string[] = [
  "haïti",
  "haiti",
  "port-au-prince",
  "cap-haïtien",
  "cap-haitien",
  "gonaïves",
  "les cayes",
  "jacmel",
  "jérémie",
  "pétion-ville",
  "delmas",
  "cité soleil",
  "artibonite",
  "ayiti",
] as const;

/** Categories that represent scholarship / opportunity content */
const OPPORTUNITY_CATEGORIES = new Set([
  "bourses",
  "scholarship",
  "concours",
  "stages",
  "programmes",
]);

/**
 * Stock-market vocabulary used to disambiguate "bourse" (which means BOTH
 * "scholarship" AND "stock exchange" in French). Lowercased; no accent
 * normalisation needed because we lowercase the input before matching.
 */
const STOCK_MARKET_KEYWORDS: readonly string[] = [
  // Named exchanges
  "bourse de new york", "bourse de paris", "bourse de tokyo",
  "bourse de londres", "bourse de hong kong", "bourse de shanghai",
  "wall street", "nasdaq", "nyse", "dow jones", "s&p 500",
  "cac 40", "ftse", "nikkei", "hang seng", "euronext",
  // Market vocabulary (FR)
  "marché boursier", "marchés boursiers", "place boursière",
  "indice boursier", "valeur boursière", "capitalisation boursière",
  "introduction en bourse", "entrée en bourse", "cotation",
  "cotée en bourse", "actionnaire", "obligataire",
  // Market vocabulary (EN)
  "stock market", "stock exchange", "stock price", "share price",
  "ipo",
];

/**
 * Phrases that confirm "bourse" really means "scholarship" (not stock market).
 */
const SCHOLARSHIP_CONFIRMATION_KEYWORDS: readonly string[] = [
  "bourse d'étud", "bourse d étud", "bourses d'étud", "bourses d étud",
  "bourse de mérite", "bourse de recherche", "bourse complète",
  "bourse partielle", "bourse doctorale", "bourse universitaire",
  "boursier", "boursière", "boursiers", "boursières",
  "candidat", "candidature", "postuler", "appel à candidatures",
  "deadline", "date limite", "éligibilit",
  "étudiant", "université", "faculté", "diplôm",
  "master", "licence", "doctorat", "phd", "fellowship", "scholarship",
  "tuition", "frais de scolarité", "prise en charge", "financement d'étud",
  "fulbright", "chevening", "erasmus",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count how many keywords from `list` appear in `text`.
 * Matching is case-insensitive.
 */
function countKeywordHits(text: string, list: readonly string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of list) {
    if (lower.includes(kw)) hits++;
  }
  return hits;
}

/** Returns true when `text` mentions a Haitian location. */
function mentionsHaiti(text: string): boolean {
  const lower = text.toLowerCase();
  return HAITI_LOCALE_TOKENS.some((t) => lower.includes(t));
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a Gemini-assigned category against the article content.
 *
 * Returns the **corrected** category (same as input when no fix is needed).
 *
 * Rules applied:
 *  1. Opportunity category + hard-news keywords  → "news" / "local_news"
 *  2. "news" + opportunity keywords + deadline   → "bourses" / "scholarship"
 *  3. "resource" + hard-news keywords            → "news"
 */
export function validateAndFixCategory(input: {
  titleFr: string;
  bodyFr: string;
  category: string;
  deadline?: string | null;
}): string {
  const { titleFr, bodyFr, category, deadline } = input;

  // Combine title + body for keyword scanning
  const combined = `${titleFr} ${bodyFr}`;
  const combinedLower = combined.toLowerCase();

  // ── Rule 0: opportunity category but content is stock-market coverage ──
  // "Bourse" (FR) means BOTH "scholarship" AND "stock exchange". Catch the
  // common false positive where a finance article gets tagged as a bourse.
  if (category === "bourses" || category === "scholarship") {
    const isStockMarket = STOCK_MARKET_KEYWORDS.some((kw) =>
      combinedLower.includes(kw),
    );
    const hasScholarship = SCHOLARSHIP_CONFIRMATION_KEYWORDS.some((kw) =>
      combinedLower.includes(kw),
    );
    if (isStockMarket && !hasScholarship) {
      const corrected = mentionsHaiti(combined) ? "local_news" : "news";
      console.warn(
        `[validate-classification] Reclassified "${category}" → "${corrected}" ` +
          `(stock-market vocabulary detected, no scholarship context). ` +
          `Title: "${titleFr.slice(0, 80)}"`,
      );
      return corrected;
    }
  }

  // ── Rule 1: opportunity category but content is hard news ──────────────
  if (OPPORTUNITY_CATEGORIES.has(category)) {
    const newsHits = countKeywordHits(combined, HARD_NEWS_KEYWORDS);
    const oppHits = countKeywordHits(combined, OPPORTUNITY_KEYWORDS);

    // Hard-news signal clearly dominates opportunity signal
    if (newsHits >= 3 && newsHits > oppHits) {
      const corrected = mentionsHaiti(combined) ? "local_news" : "news";
      console.warn(
        `[validate-classification] Reclassified "${category}" → "${corrected}" ` +
          `(${newsHits} hard-news keywords vs ${oppHits} opportunity keywords). ` +
          `Title: "${titleFr.slice(0, 80)}"`,
      );
      return corrected;
    }
  }

  // ── Rule 2: "news" but content is really an opportunity with deadline ──
  if (category === "news" || category === "local_news") {
    const oppHits = countKeywordHits(combined, OPPORTUNITY_KEYWORDS);
    const hasDeadline = Boolean(deadline && deadline.trim().length > 0);

    if (oppHits >= 3 && hasDeadline) {
      // Prefer French-oriented label when text is in French
      const corrected =
        combined.toLowerCase().includes("scholarship") ? "scholarship" : "bourses";
      console.warn(
        `[validate-classification] Reclassified "${category}" → "${corrected}" ` +
          `(${oppHits} opportunity keywords + deadline present). ` +
          `Title: "${titleFr.slice(0, 80)}"`,
      );
      return corrected;
    }
  }

  // ── Rule 3: "resource" but content is breaking news ────────────────────
  if (category === "resource") {
    const newsHits = countKeywordHits(combined, HARD_NEWS_KEYWORDS);

    if (newsHits >= 3) {
      const corrected = mentionsHaiti(combined) ? "local_news" : "news";
      console.warn(
        `[validate-classification] Reclassified "resource" → "${corrected}" ` +
          `(${newsHits} hard-news keywords). ` +
          `Title: "${titleFr.slice(0, 80)}"`,
      );
      return corrected;
    }
  }

  // No reclassification needed
  return category;
}
