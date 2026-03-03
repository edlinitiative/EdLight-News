/**
 * Shared constants and helpers for /histoire components.
 * These are UI-only — no backend logic.
 */

import type { AlmanacTag, ContentLanguage, HaitiHistoryAlmanacEntry, HaitiHoliday } from "@edlight-news/types";

// ── Serializable types (Timestamps → strings for Server→Client boundary) ────

/** HaitiHistoryAlmanacEntry with Timestamps converted to ISO strings. */
export type SerializableAlmanacEntry = Omit<HaitiHistoryAlmanacEntry, "verifiedAt" | "updatedAt"> & {
  verifiedAt: string | null;
  updatedAt: string | null;
};

/** HaitiHoliday with Timestamps converted to ISO strings. */
export type SerializableHoliday = Omit<HaitiHoliday, "verifiedAt" | "updatedAt"> & {
  verifiedAt: string | null;
  updatedAt: string | null;
};

/** Convert a Firestore Timestamp-like value to an ISO string (or null). */
function tsToStr(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const t = v as { seconds?: number; _seconds?: number; toDate?: () => Date };
  const secs = t.seconds ?? t._seconds;
  if (typeof secs === "number") return new Date(secs * 1000).toISOString();
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

export function serializeEntry(e: HaitiHistoryAlmanacEntry): SerializableAlmanacEntry {
  return { ...e, verifiedAt: tsToStr(e.verifiedAt), updatedAt: tsToStr(e.updatedAt) };
}

export function serializeHoliday(h: HaitiHoliday): SerializableHoliday {
  return { ...h, verifiedAt: tsToStr(h.verifiedAt), updatedAt: tsToStr(h.updatedAt) };
}

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

/**
 * Client-side Haiti date helper.
 * Uses Intl.DateTimeFormat so DST transitions are handled correctly.
 */
export function getHaitiMonthDayClient(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Port-au-Prince",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const mm = parts.find((p) => p.type === "month")!.value;
  const dd = parts.find((p) => p.type === "day")!.value;
  return `${mm}-${dd}`;
}

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

// ── Date-range helpers ──────────────────────────────────────────────────────

export interface DateRange {
  start: string; // MM-DD
  end: string;   // MM-DD
}

/** Number of days in a month (1-indexed). Uses 2024 as reference (leap year). */
export function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate();
}

/** Check if MM-DD `md` is within [start, end] inclusive. Handles year wrap. */
export function isInRange(md: string, start: string, end: string): boolean {
  if (start <= end) return md >= start && md <= end;
  return md >= start || md <= end; // wraps year boundary (e.g. Dec→Jan)
}

/** Return all distinct month strings ("01"–"12") spanned by a range. */
export function monthsInRange(start: string, end: string): string[] {
  const sm = parseInt(start.split("-")[0]!, 10);
  const em = parseInt(end.split("-")[0]!, 10);
  const months: string[] = [];
  if (sm <= em) {
    for (let m = sm; m <= em; m++) months.push(String(m).padStart(2, "0"));
  } else {
    for (let m = sm; m <= 12; m++) months.push(String(m).padStart(2, "0"));
    for (let m = 1; m <= em; m++) months.push(String(m).padStart(2, "0"));
  }
  return months;
}

/** Format a DateRange as a human-readable string, e.g. "1–28 février" or "15 fév. – 15 mars". */
export function formatRange(range: DateRange, lang: ContentLanguage): string {
  const mNames = lang === "fr" ? MONTH_NAMES_FR : MONTH_NAMES_HT;
  const [m1, d1] = range.start.split("-");
  const [m2, d2] = range.end.split("-");
  const mn1 = mNames[parseInt(m1!, 10) - 1] ?? m1;
  const mn2 = mNames[parseInt(m2!, 10) - 1] ?? m2;
  if (m1 === m2) return `${parseInt(d1!, 10)} – ${parseInt(d2!, 10)} ${mn2}`;
  return `${parseInt(d1!, 10)} ${mn1!.slice(0, 3)}. – ${parseInt(d2!, 10)} ${mn2!.slice(0, 3)}.`;
}

/** Validate that a range spans at most ~31 days. */
export function isRangeValid(start: string, end: string): boolean {
  const [sm, sd] = start.split("-").map(Number) as [number, number];
  const [em, ed] = end.split("-").map(Number) as [number, number];
  const sDate = new Date(2024, sm - 1, sd);
  let eDate = new Date(2024, em - 1, ed);
  if (eDate < sDate) eDate = new Date(2025, em - 1, ed);
  const diff = Math.round((eDate.getTime() - sDate.getTime()) / 86_400_000);
  return diff >= 1 && diff <= 31;
}

// ── Hero selection ──────────────────────────────────────────────────────────

const ILLUSTRATION_MIN_CONFIDENCE = 0.55;

/**
 * Pick the single best entry to feature as the "hero" card.
 *
 * Scoring:
 *   +30  has own illustration (confidence ≥ 0.55)
 *   +20  overall confidence === "high"
 *   +10  has student_takeaway
 *   + 5  title length > 20 chars (signals richer content)
 *   + year/100  recency tiebreaker
 *
 * Returns the top-scored entry, or the first entry if the list is non-empty.
 */
export function pickHeroEntry(
  entries: SerializableAlmanacEntry[],
): SerializableAlmanacEntry | null {
  if (entries.length === 0) return null;

  let best = entries[0]!;
  let bestScore = -Infinity;

  for (const e of entries) {
    let score = 0;
    const hasIllustration =
      !!e.illustration?.imageUrl &&
      (typeof e.illustration.confidence !== "number" ||
        e.illustration.confidence >= ILLUSTRATION_MIN_CONFIDENCE);
    if (hasIllustration) score += 30;
    if (e.confidence === "high") score += 20;
    if (e.student_takeaway_fr) score += 10;
    if (e.title_fr.length > 20) score += 5;
    score += (e.year ?? 0) / 100;

    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}
