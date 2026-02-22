import RSSParser from "rss-parser";

export interface RSSItem {
  title: string;
  url: string;
  description: string;
  publishedAt: Date | null;
  /** Real publisher URL extracted from Google News <source url="..."> tag */
  publisherUrl?: string;
  /** Publisher name from Google News <source> tag or title suffix */
  publisherName?: string;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org) AppleWebKit/537.36";

const parser = new RSSParser({
  timeout: 15_000,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [["source", { keepArray: false }]],
  },
});

// ── Google News helpers ───────────────────────────────────────────────────

/** Detect whether a feed URL is from Google News. */
function isGoogleNewsFeed(feedUrl: string): boolean {
  try {
    return new URL(feedUrl).hostname === "news.google.com";
  } catch {
    return false;
  }
}

/**
 * Google News titles are formatted as "Article Title - Publisher Name".
 * Strip the suffix and return { cleanTitle, publisherName }.
 */
export function parseGoogleNewsTitle(raw: string): { cleanTitle: string; publisherName: string | undefined } {
  const idx = raw.lastIndexOf(" - ");
  if (idx > 0 && idx < raw.length - 3) {
    let publisherName = raw.slice(idx + 3).trim();
    let cleanTitle = raw.slice(0, idx).trim();

    // Some publishers (e.g. HaitiLibre) use double-space before their name:
    //   "Haïti - Éducation : Headline  HaitiLibre"
    // In that case the " - " split gives a very long "publisher".
    // Fall back to the text after the last double-whitespace (may be NBSP \u00a0).
    if (publisherName.length > 40) {
      // Match 2+ consecutive spaces or non-breaking spaces
      const dblWsRe = /[\s\u00a0]{2,}/g;
      let lastMatch: RegExpExecArray | null = null;
      let m: RegExpExecArray | null;
      while ((m = dblWsRe.exec(raw)) !== null) lastMatch = m;
      if (lastMatch && lastMatch.index > 0) {
        const candidate = raw.slice(lastMatch.index + lastMatch[0].length).trim();
        if (candidate.length > 0 && candidate.length <= 40) {
          publisherName = candidate;
          cleanTitle = raw.slice(0, lastMatch.index).trim();
        }
      }
    }

    return { cleanTitle, publisherName };
  }
  return { cleanTitle: raw, publisherName: undefined };
}

/**
 * Fetch and parse an RSS feed. Returns normalised items.
 *
 * For Google News feeds, also extracts the real publisher URL from the
 * `<source url="...">` tag and strips the publisher suffix from titles.
 */
export async function fetchRSS(feedUrl: string): Promise<RSSItem[]> {
  const feed = await parser.parseURL(feedUrl);
  const isGN = isGoogleNewsFeed(feedUrl);

  return (feed.items ?? []).map((item) => {
    const rawTitle = item.title?.trim() ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceTag = (item as any).source as
      | { $: { url?: string }; _?: string }
      | string
      | undefined;

    let title = rawTitle;
    let publisherUrl: string | undefined;
    let publisherName: string | undefined;

    if (isGN) {
      // Extract publisher from <source url="...">Publisher</source>
      if (sourceTag && typeof sourceTag === "object" && "$" in sourceTag) {
        publisherUrl = sourceTag.$.url;
        publisherName = typeof sourceTag._ === "string" ? sourceTag._.trim() : undefined;
      }
      // Also parse from title suffix ("Title - Publisher")
      const parsed = parseGoogleNewsTitle(rawTitle);
      title = parsed.cleanTitle;
      if (!publisherName && parsed.publisherName) {
        publisherName = parsed.publisherName;
      }
    }

    return {
      title,
      url: item.link?.trim() ?? "",
      description:
        item.contentSnippet?.trim() ?? item.content?.trim() ?? "",
      publishedAt: item.isoDate ? new Date(item.isoDate) : null,
      publisherUrl,
      publisherName,
    };
  });
}
