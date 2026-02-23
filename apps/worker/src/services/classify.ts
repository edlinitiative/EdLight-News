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
  "prix",
  "award",
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
 * Keywords indicating a success / achievement / inspiration story.
 * Covers both French and Kreyòl Ayisyen variants.
 */
const SUCCESS_KEYWORDS = [
  // French
  "succes", "réussite", "reussite", "accomplissement", "distinction",
  "honneur", "fierté", "fierte", "exploit", "laureat", "lauréat",
  "medaille", "médaille", "champion", "remporte", "diplome obtenu",
  "diplômé", "diplome", "palmares", "palmarès", "primé", "prime",
  "parcours inspirant", "histoire inspirante", "modele de reussite",
  "parcours exemplaire", "haïtien qui brille", "haitien qui brille",
  "haïtienne qui brille", "haitienne qui brille",
  // Kreyòl Ayisyen
  "siksè", "sikse", "reyisit", "akonplisman", "fyète", "fyete",
  "chanpyon", "onè", "one",
  // English loan words common in Haitian press
  "success story", "achievement", "award-winning", "honored",
];

/** Union of all opportunity keywords — used for the top-level check. */
const ALL_OPPORTUNITY_KEYWORDS = [
  ...BOURSES_KEYWORDS,
  ...STAGES_KEYWORDS,
  ...CONCOURS_KEYWORDS,
  ...PROGRAMMES_KEYWORDS,
];

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
  const isSuccessStory = containsAny(combinedText, SUCCESS_KEYWORDS);

  // ── Quick exit if no opportunity signal ────────────────────────────────
  if (!containsAny(combinedText, ALL_OPPORTUNITY_KEYWORDS)) {
    return { isOpportunity: false, isSuccessStory };
  }

  // ── Determine subcategory (priority order: Bourses > Stages > Concours > Programmes) ──
  let category: ItemCategory;
  if (containsAny(combinedText, BOURSES_KEYWORDS)) {
    category = "bourses";
  } else if (containsAny(combinedText, STAGES_KEYWORDS)) {
    category = "stages";
  } else if (containsAny(combinedText, CONCOURS_KEYWORDS)) {
    category = "concours";
  } else {
    category = "programmes";
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
