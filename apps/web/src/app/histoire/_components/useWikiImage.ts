"use client";

/**
 * useWikiImage — fetch a thumbnail from French Wikipedia for a search query.
 *
 * Uses the MediaWiki search API + pageimages prop. Results are cached
 * in a module-level Map so repeated renders don't re-fetch.
 *
 * Returns { url, loading }. `url` is null while loading or if no image is found.
 */

import { useState, useEffect } from "react";

const cache = new Map<string, string | null>();

const WIKI_API =
  "https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&format=json&origin=*&gsrsearch=";

export function useWikiImage(query: string | null): {
  url: string | null;
  loading: boolean;
} {
  const [url, setUrl] = useState<string | null>(
    query && cache.has(query) ? (cache.get(query) ?? null) : null,
  );
  const [loading, setLoading] = useState(!!query && !cache.has(query));

  useEffect(() => {
    if (!query) {
      setUrl(null);
      setLoading(false);
      return;
    }
    if (cache.has(query)) {
      setUrl(cache.get(query) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(WIKI_API + encodeURIComponent(query));
        if (!res.ok) throw new Error("wiki");
        const data = await res.json();
        const pages = data?.query?.pages;
        let thumb: string | null = null;
        if (pages) {
          const first = Object.values(pages)[0] as Record<string, unknown> | undefined;
          const t = first?.thumbnail as { source?: string } | undefined;
          thumb = t?.source ?? null;
        }
        cache.set(query, thumb);
        if (!cancelled) {
          setUrl(thumb);
          setLoading(false);
        }
      } catch {
        cache.set(query, null);
        if (!cancelled) {
          setUrl(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return { url, loading };
}
