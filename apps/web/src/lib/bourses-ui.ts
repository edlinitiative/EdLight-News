/**
 * UI-only utilities for /bourses.
 * No backend calls — localStorage, countdown formatting, text search.
 */

// ── localStorage: saved scholarships ────────────────────────────────────────

const SAVED_KEY = "edlight_saved_scholarships";

export function getSavedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.filter((v: unknown) => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

export function toggleSaved(id: string): Set<string> {
  const ids = getSavedIds();
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
  return ids;
}

export function isSaved(id: string): boolean {
  return getSavedIds().has(id);
}

// ── Countdown helpers (deprecated — prefer lib/ui/deadlines.ts) ─────────────
// Kept as re-exports for any external consumers; internal code now uses
// getDeadlineStatus / formatDeadlineDate from @/lib/ui/deadlines.

export { getDeadlineStatus, formatDeadlineDate, formatDeadlineDateShort } from "@/lib/ui/deadlines";

// ── Text search (client-side, in-memory) ────────────────────────────────────

/**
 * Normalize a string for search matching: lowercase, strip accents.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface Searchable {
  name: string;
  tags?: string[];
  eligibilitySummary?: string;
  sources?: { label: string }[];
}

export function matchesSearch<T extends Searchable>(item: T, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  const fields = [
    item.name,
    item.eligibilitySummary ?? "",
    ...(item.tags ?? []),
    ...(item.sources?.map((s) => s.label) ?? []),
  ];
  return fields.some((f) => normalize(f).includes(q));
}
