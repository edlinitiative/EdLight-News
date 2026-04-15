const SITEMAP_URL = "https://news.edlight.org/sitemap.xml";

/**
 * Notify search engines that the sitemap has been updated.
 *
 * Google's ping endpoint asks Googlebot to re-crawl the sitemap sooner
 * than its normal schedule.  The call is fire-and-forget — failures
 * are logged but never block the pipeline.
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap#addsitemap
 */
export async function pingSearchEngines(): Promise<void> {
  const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;

  try {
    const res = await fetch(googlePingUrl, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      console.log("[ping] Google sitemap ping succeeded");
    } else {
      console.warn(`[ping] Google sitemap ping returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[ping] Google sitemap ping failed:", err instanceof Error ? err.message : err);
  }
}
