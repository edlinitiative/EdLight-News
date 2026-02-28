"use client";

/**
 * useWikiImage — fetch a thumbnail from French Wikipedia for a search query.
 *
 * Multi-query strategy for disambiguation:
 *   1. "{year} {title} Haïti" — most specific, avoids dad-vs-son / era mix-ups
 *   2. "{title} Haïti" — without year, still contextual
 *   3. "{title}" — bare fallback
 *
 * Results are cached in a module-level Map so repeated renders don't re-fetch.
 * Returns { url, loading }. `url` is null while loading or if no image is found.
 */

import { useState, useEffect } from "react";

const cache = new Map<string, string | null>();

const WIKI_API =
  "https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&format=json&origin=*&gsrsearch=";

/** Try a single Wikipedia search query and return the thumbnail URL or null. */
async function tryWikiSearch(query: string): Promise<string | null> {
  const res = await fetch(WIKI_API + encodeURIComponent(query));
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0] as Record<string, unknown> | undefined;
  const t = first?.thumbnail as { source?: string } | undefined;
  return t?.source ?? null;
}

/** Build a cache key from query + year. */
function cacheKey(query: string, year?: number | null): string {
  return year ? `${year}::${query}` : query;
}

export function useWikiImage(
  query: string | null,
  year?: number | null,
): {
  url: string | null;
  loading: boolean;
} {
  const key = query ? cacheKey(query, year) : null;

  const [url, setUrl] = useState<string | null>(
    key && cache.has(key) ? (cache.get(key) ?? null) : null,
  );
  const [loading, setLoading] = useState(!!key && !cache.has(key));

  useEffect(() => {
    if (!query || !key) {
      setUrl(null);
      setLoading(false);
      return;
    }
    if (cache.has(key)) {
      setUrl(cache.get(key) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Multi-query strategy: most specific → least specific
        const candidates: string[] = [];
        if (year) candidates.push(`${year} ${query} Haïti`);
        candidates.push(`${query} Haïti`);
        candidates.push(query);

        let thumb: string | null = null;
        for (const q of candidates) {
          thumb = await tryWikiSearch(q);
          if (thumb) break;
        }

        cache.set(key, thumb);
        if (!cancelled) {
          setUrl(thumb);
          setLoading(false);
        }
      } catch {
        cache.set(key, null);
        if (!cancelled) {
          setUrl(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query, key]);

  return { url, loading };
}
