/**
 * Bookmarks — localStorage-based reading list.
 *
 * Stores an array of content_version IDs (not item IDs) so we can
 * fetch the exact article the user bookmarked in the correct language.
 *
 * No login required for v1.
 */

const LS_KEY = "edlight_bookmarks";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    /* private browsing — noop */
  }
}

/** Get all bookmarked article IDs (content_version IDs). */
export function getBookmarks(): string[] {
  return read();
}

/** Check if an article is bookmarked. */
export function isBookmarked(id: string): boolean {
  return read().includes(id);
}

/** Add a bookmark. Returns updated list. */
export function addBookmark(id: string): string[] {
  const current = read();
  if (current.includes(id)) return current;
  const updated = [id, ...current]; // newest first
  write(updated);
  return updated;
}

/** Remove a bookmark. Returns updated list. */
export function removeBookmark(id: string): string[] {
  const current = read();
  const updated = current.filter((x) => x !== id);
  write(updated);
  return updated;
}

/** Toggle a bookmark. Returns { bookmarked, list }. */
export function toggleBookmark(id: string): { bookmarked: boolean; list: string[] } {
  if (isBookmarked(id)) {
    return { bookmarked: false, list: removeBookmark(id) };
  }
  return { bookmarked: true, list: addBookmark(id) };
}
