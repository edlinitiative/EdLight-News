/**
 * Server-side data utilities for structured datasets.
 *
 * Fetches universities, scholarships, calendar events, and pathways
 * from Firestore for the web frontend. All functions are server-only.
 * Heavy reads are cached via unstable_cache to avoid redundant Firestore hits.
 */

import { unstable_cache } from "next/cache";
import {
  universitiesRepo,
  scholarshipsRepo,
  haitiCalendarRepo,
  pathwaysRepo,
  haitiHistoryAlmanacRepo,
  haitiHolidaysRepo,
  historyPublishLogRepo,
} from "@edlight-news/firebase";
import type {
  University,
  Scholarship,
  HaitiCalendarEvent,
  Pathway,
  DatasetCountry,
  PathwayGoalKey,
  HaitiHistoryAlmanacEntry,
  HaitiHoliday,
  HistoryPublishLog,
} from "@edlight-news/types";

// ── Universities ─────────────────────────────────────────────────────────────

export const fetchAllUniversities = unstable_cache(
  async (): Promise<University[]> => universitiesRepo.listAll(),
  ["universities-all"],
  { revalidate: 900, tags: ["universities"] },
);

export const fetchUniversitiesByCountry = unstable_cache(
  async (country: DatasetCountry): Promise<University[]> =>
    universitiesRepo.listByCountry(country),
  ["universities-country"],
  { revalidate: 900, tags: ["universities"] },
);

export async function fetchUniversity(id: string): Promise<University | null> {
  return universitiesRepo.get(id);
}

export const fetchHaitianFriendlyUniversities = unstable_cache(
  async (): Promise<University[]> => {
    const all = await universitiesRepo.listAll();
    return all.filter((u) => u.haitianFriendly);
  },
  ["universities-haitian-friendly"],
  { revalidate: 900, tags: ["universities"] },
);

/** Group universities by country for the overview page. */
export const fetchUniversitiesGrouped = unstable_cache(
  async (): Promise<Record<string, University[]>> => {
    const all = await universitiesRepo.listAll();
    const grouped: Record<string, University[]> = {};
    for (const uni of all) {
      if (!grouped[uni.country]) grouped[uni.country] = [];
      grouped[uni.country]!.push(uni);
    }
    return grouped;
  },
  ["universities-grouped"],
  { revalidate: 900, tags: ["universities"] },
);

// ── Scholarships ─────────────────────────────────────────────────────────────

export const fetchAllScholarships = unstable_cache(
  async (): Promise<Scholarship[]> => scholarshipsRepo.listAll(),
  ["scholarships-all"],
  { revalidate: 300, tags: ["scholarships"] },
);

export async function fetchScholarship(id: string): Promise<Scholarship | null> {
  return scholarshipsRepo.get(id);
}

export const fetchScholarshipsForHaiti = unstable_cache(
  async (): Promise<Scholarship[]> => scholarshipsRepo.listEligibleForHaiti(),
  ["scholarships-haiti"],
  { revalidate: 300, tags: ["scholarships"] },
);

export const fetchScholarshipsClosingSoon = unstable_cache(
  async (days: number = 30): Promise<Scholarship[]> =>
    scholarshipsRepo.listClosingSoon(days),
  ["scholarships-closing"],
  { revalidate: 300, tags: ["scholarships"] },
);

// ── Haiti Education Calendar ─────────────────────────────────────────────────

export const fetchAllCalendarEvents = unstable_cache(
  async (): Promise<HaitiCalendarEvent[]> => haitiCalendarRepo.listAll(),
  ["calendar-all"],
  { revalidate: 300, tags: ["calendar"] },
);

export const fetchUpcomingCalendarEvents = unstable_cache(
  async (): Promise<HaitiCalendarEvent[]> => haitiCalendarRepo.listUpcoming(),
  ["calendar-upcoming"],
  { revalidate: 300, tags: ["calendar"] },
);

export async function fetchCalendarEvent(
  id: string,
): Promise<HaitiCalendarEvent | null> {
  return haitiCalendarRepo.get(id);
}

// ── Pathways ─────────────────────────────────────────────────────────────────

export const fetchAllPathways = unstable_cache(
  async (): Promise<Pathway[]> => pathwaysRepo.listAll(),
  ["pathways-all"],
  { revalidate: 900, tags: ["pathways"] },
);

export async function fetchPathway(id: string): Promise<Pathway | null> {
  return pathwaysRepo.get(id);
}

export const fetchPathwaysByGoal = unstable_cache(
  async (goalKey: PathwayGoalKey): Promise<Pathway[]> =>
    pathwaysRepo.listByGoalKey(goalKey),
  ["pathways-goal"],
  { revalidate: 900, tags: ["pathways"] },
);

// ── Country display helpers ──────────────────────────────────────────────────

export const COUNTRY_LABELS: Record<DatasetCountry, { fr: string; ht: string; flag: string }> = {
  US: { fr: "États-Unis", ht: "Etazini", flag: "US" },
  CA: { fr: "Canada", ht: "Kanada", flag: "CA" },
  FR: { fr: "France", ht: "Frans", flag: "FR" },
  UK: { fr: "Royaume-Uni", ht: "Wayòm Ini", flag: "UK" },
  DO: { fr: "Rép. Dominicaine", ht: "Rep. Dominikèn", flag: "DO" },
  MX: { fr: "Mexique", ht: "Meksik", flag: "MX" },
  CN: { fr: "Chine", ht: "Lachin", flag: "CN" },
  RU: { fr: "Russie", ht: "Larisi", flag: "RU" },
  HT: { fr: "Haïti", ht: "Ayiti", flag: "HT" },
  Global: { fr: "International", ht: "Entènasyonal", flag: "" },
};

export const TUITION_LABELS: Record<string, { fr: string; ht: string }> = {
  free: { fr: "Gratuit", ht: "Gratis" },
  low: { fr: "Bas (<5 000 USD/an)", ht: "Ba (<5 000 USD/ane)" },
  medium: { fr: "Moyen (5-20k USD/an)", ht: "Mwayen (5-20k USD/ane)" },
  high: { fr: "Élevé (>20k USD/an)", ht: "Wo (>20k USD/ane)" },
};

// ── Haiti History Almanac ────────────────────────────────────────────────────

export const fetchAlmanacByMonthDay = unstable_cache(
  async (monthDay: string): Promise<HaitiHistoryAlmanacEntry[]> =>
    haitiHistoryAlmanacRepo.listByMonthDay(monthDay),
  ["almanac-monthday"],
  { revalidate: 3600, tags: ["almanac"] },
);

export const fetchAlmanacByMonth = unstable_cache(
  async (month: string): Promise<HaitiHistoryAlmanacEntry[]> =>
    haitiHistoryAlmanacRepo.listByMonth(month),
  ["almanac-month"],
  { revalidate: 3600, tags: ["almanac"] },
);

export const fetchAllAlmanacEntries = unstable_cache(
  async (): Promise<HaitiHistoryAlmanacEntry[]> =>
    haitiHistoryAlmanacRepo.listAll(),
  ["almanac-all"],
  { revalidate: 3600, tags: ["almanac"] },
);

// ── Haiti Holidays ──────────────────────────────────────────────────────────

export const fetchHolidaysByMonthDay = unstable_cache(
  async (monthDay: string): Promise<HaitiHoliday[]> =>
    haitiHolidaysRepo.listByMonthDay(monthDay),
  ["holidays-monthday"],
  { revalidate: 3600, tags: ["holidays"] },
);

export const fetchAllHolidays = unstable_cache(
  async (): Promise<HaitiHoliday[]> => haitiHolidaysRepo.listAll(),
  ["holidays-all"],
  { revalidate: 3600, tags: ["holidays"] },
);

// ── History Publish Log ─────────────────────────────────────────────────────

export async function fetchHistoryLogByDate(
  dateISO: string,
): Promise<HistoryPublishLog | null> {
  return historyPublishLogRepo.getByDate(dateISO);
}

export const fetchRecentHistoryLogs = unstable_cache(
  async (limit: number = 30): Promise<HistoryPublishLog[]> =>
    historyPublishLogRepo.listRecent(limit),
  ["history-logs"],
  { revalidate: 900, tags: ["history-logs"] },
);

// ── Haiti timezone helper (UTC-5, no DST) ────────────────────────────────────

export function getHaitiMonthDay(): string {
  const utc = new Date();
  const haiti = new Date(utc.getTime() - 5 * 60 * 60 * 1000);
  const mm = String(haiti.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(haiti.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

export function getHaitiDateISO(): string {
  const utc = new Date();
  const haiti = new Date(utc.getTime() - 5 * 60 * 60 * 1000);
  const yyyy = haiti.getUTCFullYear();
  const mm = String(haiti.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(haiti.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
