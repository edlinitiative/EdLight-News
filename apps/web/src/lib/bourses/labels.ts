/**
 * Shared display labels for the /bourses UI.
 *
 * Single source of truth for funding, level, and country labels used across
 * the scholarship cards, rows, sidebar, quick-preview, and compare views.
 * Pure data + helpers — no side effects.
 */

import type {
  AcademicLevel,
  DatasetCountry,
  ScholarshipFundingType,
  ContentLanguage,
} from "@edlight-news/types";

export const FUNDING_LABELS: Record<
  string,
  { fr: string; ht: string; dot: string }
> = {
  full: { fr: "Complet", ht: "Konplè", dot: "bg-emerald-500" },
  partial: { fr: "Partiel", ht: "Pasyèl", dot: "bg-amber-500" },
  stipend: { fr: "Allocation", ht: "Alokasyon", dot: "bg-amber-500" },
  "tuition-only": { fr: "Scolarité", ht: "Frè etid", dot: "bg-violet-500" },
  unknown: { fr: "À vérifier", ht: "Pou verifye", dot: "bg-stone-400" },
};

export const LEVEL_LABELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor: { fr: "Licence", ht: "Lisans" },
  master: { fr: "Master", ht: "Metriz" },
  phd: { fr: "PhD", ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

/** Compact level label for badges (single word where possible). */
export const LEVEL_SHORT: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor: { fr: "Licence", ht: "Lisans" },
  master: { fr: "Master", ht: "Metriz" },
  phd: { fr: "PhD", ht: "Doktora" },
  short_programs: { fr: "Courts prog.", ht: "Pwog. kout" },
};

export const COUNTRY_EMOJI: Record<DatasetCountry, string> = {
  US: "🇺🇸",
  CA: "🇨🇦",
  FR: "🇫🇷",
  UK: "🇬🇧",
  DO: "🇩🇴",
  MX: "🇲🇽",
  CN: "🇨🇳",
  RU: "🇷🇺",
  HT: "🇭🇹",
  Global: "🌍",
};

export const COUNTRY_LABELS: Record<
  DatasetCountry,
  { fr: string; ht: string; code: string }
> = {
  US: { fr: "États-Unis", ht: "Etazini", code: "USA" },
  CA: { fr: "Canada", ht: "Kanada", code: "CAN" },
  FR: { fr: "France", ht: "Frans", code: "FRA" },
  UK: { fr: "Royaume-Uni", ht: "Wayòm Ini", code: "UK" },
  DO: { fr: "Rép. Dominicaine", ht: "Rep. Dominikèn", code: "DO" },
  MX: { fr: "Mexique", ht: "Meksik", code: "MEX" },
  CN: { fr: "Chine", ht: "Lachin", code: "CHN" },
  RU: { fr: "Russie", ht: "Larisi", code: "RUS" },
  HT: { fr: "Haïti", ht: "Ayiti", code: "HT" },
  Global: { fr: "International", ht: "Entènasyonal", code: "GLOBAL" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function countryEmoji(country: DatasetCountry): string {
  return COUNTRY_EMOJI[country] ?? COUNTRY_EMOJI.Global;
}

export function countryCode(country: DatasetCountry): string {
  return COUNTRY_LABELS[country]?.code ?? String(country).toUpperCase();
}

export function fundingLabel(
  ft: ScholarshipFundingType,
  lang: ContentLanguage,
): { text: string; dot: string } | null {
  const f = FUNDING_LABELS[ft];
  if (!f || ft === "unknown") return null;
  return { text: lang === "fr" ? f.fr : f.ht, dot: f.dot };
}

export function levelBadges(
  levels: AcademicLevel[],
  lang: ContentLanguage,
): string[] {
  return levels.map((l) =>
    LEVEL_SHORT[l] ? (lang === "fr" ? LEVEL_SHORT[l].fr : LEVEL_SHORT[l].ht) : l,
  );
}

export function levelText(
  levels: AcademicLevel[],
  lang: ContentLanguage,
): string {
  return levels
    .map((l) => (LEVEL_LABELS[l] ? (lang === "fr" ? LEVEL_LABELS[l].fr : LEVEL_LABELS[l].ht) : l))
    .join(" · ");
}
