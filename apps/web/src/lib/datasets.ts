/**
 * Server-side data utilities for structured datasets.
 *
 * Fetches universities, scholarships, calendar events, and pathways
 * from Firestore for the web frontend. All functions are server-only.
 */

import {
  universitiesRepo,
  scholarshipsRepo,
  haitiCalendarRepo,
  pathwaysRepo,
} from "@edlight-news/firebase";
import type {
  University,
  Scholarship,
  HaitiCalendarEvent,
  Pathway,
  DatasetCountry,
  PathwayGoalKey,
} from "@edlight-news/types";

// ── Universities ─────────────────────────────────────────────────────────────

export async function fetchAllUniversities(): Promise<University[]> {
  return universitiesRepo.listAll();
}

export async function fetchUniversitiesByCountry(
  country: DatasetCountry,
): Promise<University[]> {
  return universitiesRepo.listByCountry(country);
}

export async function fetchUniversity(id: string): Promise<University | null> {
  return universitiesRepo.get(id);
}

export async function fetchHaitianFriendlyUniversities(): Promise<University[]> {
  const all = await universitiesRepo.listAll();
  return all.filter((u) => u.haitianFriendly);
}

/** Group universities by country for the overview page. */
export async function fetchUniversitiesGrouped(): Promise<
  Record<string, University[]>
> {
  const all = await universitiesRepo.listAll();
  const grouped: Record<string, University[]> = {};
  for (const uni of all) {
    if (!grouped[uni.country]) grouped[uni.country] = [];
    grouped[uni.country]!.push(uni);
  }
  return grouped;
}

// ── Scholarships ─────────────────────────────────────────────────────────────

export async function fetchAllScholarships(): Promise<Scholarship[]> {
  return scholarshipsRepo.listAll();
}

export async function fetchScholarship(id: string): Promise<Scholarship | null> {
  return scholarshipsRepo.get(id);
}

export async function fetchScholarshipsForHaiti(): Promise<Scholarship[]> {
  return scholarshipsRepo.listEligibleForHaiti();
}

export async function fetchScholarshipsClosingSoon(
  days = 30,
): Promise<Scholarship[]> {
  return scholarshipsRepo.listClosingSoon(days);
}

// ── Haiti Education Calendar ─────────────────────────────────────────────────

export async function fetchAllCalendarEvents(): Promise<HaitiCalendarEvent[]> {
  return haitiCalendarRepo.listAll();
}

export async function fetchUpcomingCalendarEvents(): Promise<HaitiCalendarEvent[]> {
  return haitiCalendarRepo.listUpcoming();
}

export async function fetchCalendarEvent(
  id: string,
): Promise<HaitiCalendarEvent | null> {
  return haitiCalendarRepo.get(id);
}

// ── Pathways ─────────────────────────────────────────────────────────────────

export async function fetchAllPathways(): Promise<Pathway[]> {
  return pathwaysRepo.listAll();
}

export async function fetchPathway(id: string): Promise<Pathway | null> {
  return pathwaysRepo.get(id);
}

export async function fetchPathwaysByGoal(
  goalKey: PathwayGoalKey,
): Promise<Pathway[]> {
  return pathwaysRepo.listByGoalKey(goalKey);
}

// ── Country display helpers ──────────────────────────────────────────────────

export const COUNTRY_LABELS: Record<DatasetCountry, { fr: string; ht: string; flag: string }> = {
  US: { fr: "États-Unis", ht: "Etazini", flag: "🇺🇸" },
  CA: { fr: "Canada", ht: "Kanada", flag: "🇨🇦" },
  FR: { fr: "France", ht: "Frans", flag: "🇫🇷" },
  UK: { fr: "Royaume-Uni", ht: "Wayòm Ini", flag: "🇬🇧" },
  DO: { fr: "Rép. Dominicaine", ht: "Rep. Dominikèn", flag: "🇩🇴" },
  MX: { fr: "Mexique", ht: "Meksik", flag: "🇲🇽" },
  CN: { fr: "Chine", ht: "Lachin", flag: "🇨🇳" },
  RU: { fr: "Russie", ht: "Larisi", flag: "🇷🇺" },
  HT: { fr: "Haïti", ht: "Ayiti", flag: "🇭🇹" },
  Global: { fr: "International", ht: "Entènasyonal", flag: "🌍" },
};

export const TUITION_LABELS: Record<string, { fr: string; ht: string }> = {
  free: { fr: "Gratuit", ht: "Gratis" },
  low: { fr: "Bas (<5 000 USD/an)", ht: "Ba (<5 000 USD/ane)" },
  medium: { fr: "Moyen (5-20k USD/an)", ht: "Mwayen (5-20k USD/ane)" },
  high: { fr: "Élevé (>20k USD/an)", ht: "Wo (>20k USD/ane)" },
};
