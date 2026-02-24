/**
 * Opportunity-page helpers — deterministic subcategory mapping,
 * deadline parsing, level/region inference.
 *
 * Pure functions, no Firestore access. Safe for client components.
 */

import type { FeedItem } from "@/components/news-feed";
import type { ContentLanguage } from "@edlight-news/types";
import {
  classifyOpportunity,
  type OpportunitySubcategory,
} from "./opportunityClassifier";

// ── Types ────────────────────────────────────────────────────────────────────

export type OpportunitySubCat =
  | "bourses"
  | "concours"
  | "stages"
  | "programmes"
  | "ressources"
  | "autre";

export type StudyLevel = "lycee" | "licence" | "master" | "doctorat";

export type RegionChip = "haiti" | "international";

export interface DeadlineInfo {
  /** ISO string (YYYY-MM-DD) if we could parse a date */
  iso: string | null;
  /** Human-readable short label: "15 mars" or "à confirmer" */
  label: string;
  /** True when no reliable date could be extracted */
  missing: boolean;
}

// ── Text normalisation ───────────────────────────────────────────────────────

/** Strip accents and lowercase for keyword matching. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Build a searchable blob from an article's visible text. */
function textBlob(article: FeedItem): string {
  return norm(`${article.title ?? ""} ${article.summary ?? ""} ${article.body ?? ""}`);
}

// ── A) Deterministic subcategory mapping (delegates to classifier) ───────────

/** Map PascalCase classifier output to internal lowercase subcategory. */
const SUBCAT_MAP: Record<OpportunitySubcategory, OpportunitySubCat> = {
  Bourses: "bourses",
  Concours: "concours",
  Stages: "stages",
  Programmes: "programmes",
  Ressources: "ressources",
  Autre: "autre",
};

/**
 * Classify an opportunity article into a subcategory.
 * Delegates to the deterministic keyword classifier.
 */
export function deriveSubcategory(article: FeedItem): OpportunitySubCat {
  const result = classifyOpportunity({
    title: article.title ?? "",
    summary: article.summary,
    body: article.body,
    category: article.category,
    publisher: article.sourceName,
    url: article.sourceUrl,
  });
  return SUBCAT_MAP[result.subcategory];
}

// ── B) Deadline parsing ──────────────────────────────────────────────────────

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
};

/**
 * Attempt to parse a deadline date.
 *
 * 1) Use item.deadline (from Firestore) if present.
 * 2) Regex-scan title + summary for French date patterns near deadline keywords.
 * 3) Fall back to "missing".
 */
export function parseDeadline(article: FeedItem, lang: ContentLanguage): DeadlineInfo {
  // 1) Structured deadline from item
  if (article.deadline) {
    const d = new Date(article.deadline);
    if (!isNaN(d.getTime())) {
      return {
        iso: article.deadline,
        label: formatShortDate(d, lang),
        missing: false,
      };
    }
  }

  // 2) Regex extraction from text
  const text = norm(`${article.title ?? ""} ${article.summary ?? ""}`);
  const extracted = extractDateNearKeyword(text);
  if (extracted) {
    return {
      iso: extracted.toISOString().slice(0, 10),
      label: formatShortDate(extracted, lang),
      missing: false,
    };
  }

  // 3) Missing
  return {
    iso: null,
    label: lang === "fr" ? "à confirmer" : "pou konfime",
    missing: true,
  };
}

/** Format a Date to short "15 mars" style. */
function formatShortDate(d: Date, lang: ContentLanguage): string {
  const locale = lang === "ht" ? "fr-HT" : "fr-FR";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/**
 * Scan normalised text for a date pattern near deadline-related keywords.
 * Returns a Date if found, null otherwise.
 */
function extractDateNearKeyword(text: string): Date | null {
  const deadlineKwPattern =
    /(?:date limite|limite|deadline|cloture|echeance|avant le|jusqu.au)/;
  if (!deadlineKwPattern.test(text)) return null;

  // Pattern: DD month YYYY (e.g., "15 mars 2026")
  const monthNames = Object.keys(FRENCH_MONTHS).join("|");
  const dateRe = new RegExp(
    `(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`,
    "g",
  );

  let match: RegExpExecArray | null;
  while ((match = dateRe.exec(text)) !== null) {
    const day = parseInt(match[1]!, 10);
    const month = FRENCH_MONTHS[match[2]!];
    const year = parseInt(match[3]!, 10);
    if (month !== undefined && day >= 1 && day <= 31 && year >= 2024 && year <= 2030) {
      return new Date(year, month, day);
    }
  }

  // Pattern: YYYY-MM-DD (ISO dates in text)
  const isoRe = /(\d{4})-(\d{2})-(\d{2})/g;
  while ((match = isoRe.exec(text)) !== null) {
    const d = new Date(match[0]!);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

// ── C) Level & Region inference ──────────────────────────────────────────────

const LEVEL_RULES: { level: StudyLevel; keywords: string[] }[] = [
  { level: "doctorat", keywords: ["doctorat", "phd", "ph.d", "doctoral"] },
  { level: "master", keywords: ["master", "maitrise", "m2", "m1", "mba"] },
  { level: "licence", keywords: ["licence", "undergraduate", "bachelor", "l3", "l2", "l1"] },
  { level: "lycee", keywords: ["lycee", "secondaire", "bac", "terminale", "baccalaureat"] },
];

/** Best-effort study level from article text. Returns null if unclear. */
export function inferLevel(article: FeedItem): StudyLevel | null {
  const blob = textBlob(article);
  for (const rule of LEVEL_RULES) {
    if (rule.keywords.some((k) => blob.includes(k))) return rule.level;
  }
  return null;
}

const LEVEL_LABELS: Record<StudyLevel, { fr: string; ht: string }> = {
  lycee:    { fr: "Lycée",    ht: "Lise"    },
  licence:  { fr: "Licence",  ht: "Lisans"  },
  master:   { fr: "Master",   ht: "Mast"    },
  doctorat: { fr: "Doctorat", ht: "Doktora" },
};

export function levelLabel(level: StudyLevel, lang: ContentLanguage): string {
  return LEVEL_LABELS[level][lang];
}

/** Derive a region chip from the article's geoTag or text content. */
export function inferRegion(article: FeedItem): RegionChip {
  if (article.geoTag === "HT") return "haiti";
  const blob = textBlob(article);
  if (
    blob.includes("haiti") ||
    blob.includes("ayiti") ||
    blob.includes("port-au-prince") ||
    blob.includes("ueh") ||
    blob.includes("menfp")
  ) {
    return "haiti";
  }
  return "international";
}

export function regionLabel(region: RegionChip, lang: ContentLanguage): string {
  if (region === "haiti") return lang === "fr" ? "Haïti" : "Ayiti";
  return "International";
}

// ── Subcategory labels ───────────────────────────────────────────────────────

export const SUBCAT_LABELS: Record<OpportunitySubCat | "all", { fr: string; ht: string }> = {
  all:        { fr: "Tout",        ht: "Tout"    },
  bourses:    { fr: "Bourses",     ht: "Bous"    },
  concours:   { fr: "Concours",    ht: "Konkou"  },
  stages:     { fr: "Stages",      ht: "Estaj"   },
  programmes: { fr: "Programmes",  ht: "Pwogram" },
  ressources: { fr: "Ressources",  ht: "Resous"  },
  autre:      { fr: "Autre",       ht: "Lòt"     },
};
/** Subcategory → Tailwind color classes for badges. */
export const SUBCAT_COLORS: Record<OpportunitySubCat, string> = {
  bourses:    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  concours:   "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  stages:     "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  programmes: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  ressources: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  autre:      "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300",
};