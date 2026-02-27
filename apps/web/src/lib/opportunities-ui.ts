/**
 * UI-only utilities for /opportunites.
 * No backend calls — localStorage for saved opportunities, text search.
 */

// ── localStorage: saved opportunities ───────────────────────────────────────

const SAVED_KEY = "edlight_saved_opportunities";

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

// ── Text search (client-side, in-memory) ────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchesSearch(title: string, summary: string | undefined, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  const blob = normalize(`${title} ${summary ?? ""}`);
  return blob.includes(q);
}
