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

const WIKI_API =
  "https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&format=json&origin=*&gsrsearch=";

async function tryWikiSearch(query: string): Promise<string | null> {
  try {
    const res = await fetch(WIKI_API + encodeURIComponent(query), {
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

/** Resolve the best Wikipedia thumbnail for a title/year combo. Cached 24 h. */
const resolveWikiThumb = unstable_cache(
  async (title: string, year: number | null): Promise<string | null> => {
    const candidates: string[] = [];

    // Try the exact title first (most specific)
    if (year) candidates.push(`"${title}" ${year}`);
    candidates.push(`"${title}"`);

    // Extract a proper-noun name from the title (e.g. "Ertha Pascal-Trouillot"
    // from "Cérémonie d'investiture d'Ertha Pascal-Trouillot") and search that.
    const nameMatch = title.match(
      /(?:d[e'']|de la |du |des )([A-ZÀ-ÖØ-Þ][\w'-]+(?:\s+[A-ZÀ-ÖØ-Þ][\w'-]+)+)/,
    );
    if (nameMatch) {
      const name = nameMatch[1]!;
      candidates.push(`${name} Haïti`);
      candidates.push(name);
    }

    // Generic fallbacks
    if (year) candidates.push(`${title} ${year} Haïti`);
    candidates.push(`${title} Haïti`);
    candidates.push(title);

    for (const q of candidates) {
      const thumb = await tryWikiSearch(q);
      if (thumb) return thumb;
    }
    return null;
  },
  ["wiki-thumb-v2"],
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
