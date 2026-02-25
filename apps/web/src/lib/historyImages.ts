import { unstable_cache } from "next/cache";

export interface HistoryImageResult {
  imageUrl: string;
  pageUrl: string;
  pageTitle: string;
  author?: string;
  license?: string;
}

type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
  };
};

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeTitle(raw: string): string {
  return raw
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchCommonsImage(query: string): Promise<HistoryImageResult | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6"); // File namespace
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiurlwidth", "1280");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "EdLight-News/1.0 (history image lookup)" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    query?: { pages?: Record<string, CommonsPage> };
  };

  const pages = Object.values(json.query?.pages ?? {});
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const imageUrl = info?.thumburl ?? info?.url;
    if (!imageUrl || !p.pageid || !p.title) continue;

    const author = stripHtml(info.extmetadata?.Artist?.value);
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value);

    return {
      imageUrl,
      pageUrl: `https://commons.wikimedia.org/?curid=${p.pageid}`,
      pageTitle: p.title,
      author,
      license,
    };
  }

  return null;
}

export const fetchHistoryIllustration = unstable_cache(
  async (titleFr: string, year?: number | null): Promise<HistoryImageResult | null> => {
    const base = normalizeTitle(titleFr);
    if (!base) return null;

    const queryCandidates = [
      `${base} Haiti`,
      `${base} Haïti`,
      year ? `${year} ${base} Haiti` : null,
      `${base} illustration Haiti`,
    ].filter((q): q is string => Boolean(q));

    for (const q of queryCandidates) {
      const result = await searchCommonsImage(q);
      if (result) return result;
    }

    return null;
  },
  ["history-illustrations"],
  { revalidate: 60 * 60 * 24 * 7, tags: ["history-images"] },
);
