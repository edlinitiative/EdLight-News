/**
 * GET /api/histoire/wiki-image?q=<title>&year=<year>
 *
 * Server-side Wikipedia thumbnail proxy with Next.js caching.
 * Caches each unique (title, year) pair for 24 hours so the
 * Wikipedia API is only hit once per entry, not once per user.
 *
 * Returns: { url: string | null }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";

const WIKI_FR_API =
  "https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&format=json&origin=*&gsrsearch=";
const WIKI_EN_API =
  "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&format=json&origin=*&gsrsearch=";

/** Search a single Wikipedia instance and return the first thumbnail, or null. */
async function searchWiki(apiBase: string, query: string): Promise<string | null> {
  try {
    const res = await fetch(apiBase + encodeURIComponent(query), {
      headers: { "User-Agent": "EdLight-News/1.0 (news.edlight.org)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const first = Object.values(pages)[0] as Record<string, unknown> | undefined;
    const t = first?.thumbnail as { source?: string } | undefined;
    return t?.source ?? null;
  } catch {
    return null;
  }
}

/** Try French Wikipedia first, then English Wikipedia. */
async function tryWikiSearch(query: string): Promise<string | null> {
  return await searchWiki(WIKI_FR_API, query) ?? await searchWiki(WIKI_EN_API, query);
}

/** Check whether a Wikipedia page exists for the query (even without an image). */
async function wikiPageExists(query: string): Promise<boolean> {
  try {
    const res = await fetch(WIKI_FR_API + encodeURIComponent(query), {
      headers: { "User-Agent": "EdLight-News/1.0 (news.edlight.org)" },
    });
    if (!res.ok) return false;
    const data = await res.json();
    const pages = data?.query?.pages;
    return !!pages && Object.keys(pages).length > 0;
  } catch {
    return false;
  }
}

/** Resolve the best Wikipedia thumbnail for a title/year combo. Cached 24 h. */
const resolveWikiThumb = unstable_cache(
  async (title: string, year: number | null): Promise<string | null> => {
    // 1. Try the exact-quoted title (most specific)
    if (year) {
      const thumb = await tryWikiSearch(`"${title}" ${year}`);
      if (thumb) return thumb;
    }
    {
      const thumb = await tryWikiSearch(`"${title}"`);
      if (thumb) return thumb;
    }

    // 2. Extract a proper-noun name from the title (e.g. "Ertha Pascal-Trouillot"
    //    from "Cérémonie d'investiture d'Ertha Pascal-Trouillot").
    //    If we find the correct Wikipedia page for that person but it has no
    //    thumbnail, STOP here — don't fall through to generic queries that
    //    might match an unrelated person's page.
    const nameMatch = title.match(
      /(?:d[e''\u2019]|de la |du |des )([A-ZÀ-ÖØ-Þ][\w'-]+(?:\s+[A-ZÀ-ÖØ-Þ][\w'-]+)+)/,
    );
    if (nameMatch) {
      const name = nameMatch[1]!;
      // tryWikiSearch already checks both fr + en Wikipedia
      const thumb = await tryWikiSearch(`${name} Haïti`) ?? await tryWikiSearch(name);
      if (thumb) return thumb;
      // The person's page exists on fr.wikipedia but has no image, and en
      // didn't have one either — stop here rather than risking a wrong image.
      if (await wikiPageExists(name)) return null;
    }

    // 3. Generic fallbacks (only reached if no specific person was identified)
    if (year) {
      const thumb = await tryWikiSearch(`${title} ${year} Haïti`);
      if (thumb) return thumb;
    }
    return await tryWikiSearch(`${title} Haïti`) ?? await tryWikiSearch(title);
  },
  ["wiki-thumb-v4"],
  { revalidate: 86400 }, // 24 hours
);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ url: null });
  }

  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) || null : null;

  // Use title as the cache discriminator
  const url = await resolveWikiThumb(q.trim(), year);
  return NextResponse.json({ url });
}
