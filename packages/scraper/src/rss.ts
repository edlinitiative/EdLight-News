import RSSParser from "rss-parser";

export interface RSSItem {
  title: string;
  url: string;
  description: string;
  publishedAt: Date | null;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org) AppleWebKit/537.36";

const parser = new RSSParser({
  timeout: 15_000,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

/**
 * Fetch and parse an RSS feed. Returns normalised items.
 */
export async function fetchRSS(feedUrl: string): Promise<RSSItem[]> {
  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? []).map((item) => ({
    title: item.title?.trim() ?? "",
    url: item.link?.trim() ?? "",
    description:
      item.contentSnippet?.trim() ?? item.content?.trim() ?? "",
    publishedAt: item.isoDate ? new Date(item.isoDate) : null,
  }));
}
