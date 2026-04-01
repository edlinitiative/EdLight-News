"use client";

/**
 * useWikiImage — fetch a thumbnail via the server-side /api/histoire/wiki-image
 * proxy (which caches responses for 24 h via Next.js unstable_cache).
 *
 * By going through the server route instead of fr.wikipedia.org directly:
 *   - Wikipedia is only hit once per unique (title, year) pair globally, not
 *     once per user / per card render.
 *   - The module-level client cache prevents duplicate in-flight requests
 *     within the same browser session.
 *
 * Returns { url, loading }. `url` is null while loading or if no image found.
 */

import { useState, useEffect } from "react";

const cache = new Map<string, string | null>();

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

    const params = new URLSearchParams({ q: query });
    if (year != null) params.set("year", String(year));

    fetch(`/api/histoire/wiki-image?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { url: null }))
      .then((data: { url: string | null }) => {
        cache.set(key, data.url ?? null);
        if (!cancelled) {
          setUrl(data.url ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        cache.set(key, null);
        if (!cancelled) {
          setUrl(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, key, year]);

  return { url, loading };
}

