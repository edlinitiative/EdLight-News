/**
 * Shared constants and helpers for /histoire components.
 * These are UI-only — no backend logic.
 */

import type { AlmanacTag, ContentLanguage } from "@edlight-news/types";

export const TAG_LABELS: Record<AlmanacTag, { fr: string; ht: string; color: string }> = {
  independence:  { fr: "Indépendance",  ht: "Endepandans",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  culture:       { fr: "Culture",       ht: "Kilti",        color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  education:     { fr: "Éducation",     ht: "Edikasyon",    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  politics:      { fr: "Politique",     ht: "Politik",      color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  science:       { fr: "Science",       ht: "Syans",        color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  military:      { fr: "Militaire",     ht: "Militè",       color: "bg-stone-100 text-stone-800 dark:bg-stone-700 dark:text-stone-300" },
  economy:       { fr: "Économie",      ht: "Ekonomi",      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  literature:    { fr: "Littérature",   ht: "Literati",     color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  art:           { fr: "Art",           ht: "La",           color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  religion:      { fr: "Religion",      ht: "Relijyon",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  sports:        { fr: "Sports",        ht: "Espò",         color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  disaster:      { fr: "Catastrophe",   ht: "Katastwòf",    color: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-300" },
  diplomacy:     { fr: "Diplomatie",    ht: "Diplomasi",    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  resistance:    { fr: "Résistance",    ht: "Rezistans",    color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  revolution:    { fr: "Révolution",    ht: "Revolisyon",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export const ALL_TAGS: AlmanacTag[] = [
  "independence", "culture", "education", "politics", "science",
  "military", "economy", "literature", "art", "religion",
  "sports", "disaster", "diplomacy", "resistance", "revolution",
];

export const FILTER_TAGS: AlmanacTag[] = [
  "revolution", "independence", "culture", "education", "politics",
  "resistance", "diplomacy", "literature",
];

export const MONTH_NAMES_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const MONTH_NAMES_HT = [
  "janvye", "fevriye", "mas", "avril", "me", "jen",
  "jiyè", "out", "septanm", "oktòb", "novanm", "desanm",
];

export const DAY_NAMES_FR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const DAY_NAMES_HT = ["dim.", "len.", "mad.", "mèk.", "jed.", "van.", "sam."];

/** Format MM-DD → "23 février" */
export function formatMonthDay(monthDay: string, lang: ContentLanguage): string {
  const [mm, dd] = monthDay.split("-");
  const monthIdx = parseInt(mm!, 10) - 1;
  const name = lang === "fr" ? MONTH_NAMES_FR[monthIdx] : MONTH_NAMES_HT[monthIdx];
  return `${parseInt(dd!, 10)} ${name ?? mm}`;
}

/** Get an array of MM-DD strings for 7 days centred around a given MM-DD (±3). */
export function getWeekAroundDate(centreMonthDay: string): string[] {
  const [mm, dd] = centreMonthDay.split("-");
  const year = new Date().getFullYear();
  const centre = new Date(year, parseInt(mm!, 10) - 1, parseInt(dd!, 10));
  const days: string[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(centre);
    d.setDate(d.getDate() + i);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${m}-${day}`);
  }
  return days;
}

/** Build a date label object for a MM-DD string. */
export function getDayLabel(monthDay: string, lang: ContentLanguage) {
  const [mm, dd] = monthDay.split("-");
  const year = new Date().getFullYear();
  const date = new Date(year, parseInt(mm!, 10) - 1, parseInt(dd!, 10));
  const dayOfWeek = date.getDay();
  const dayNames = lang === "fr" ? DAY_NAMES_FR : DAY_NAMES_HT;
  const monthNames = lang === "fr" ? MONTH_NAMES_FR : MONTH_NAMES_HT;
  return {
    dayName: dayNames[dayOfWeek] ?? "",
    dayNumber: parseInt(dd!, 10),
    monthName: monthNames[parseInt(mm!, 10) - 1] ?? "",
    monthDay,
  };
}
