import { Timestamp } from "firebase-admin/firestore";
import { sourcesRepo, rawItemsRepo } from "@edlight-news/firebase";
import { fetchRSS, scrapeHTML, computeHash } from "@edlight-news/scraper";
import type { Source, RawItemStatus } from "@edlight-news/types";

/** Maximum items to ingest per source per tick */
const PER_SOURCE_LIMIT = parseInt(process.env.INGEST_PER_SOURCE_LIMIT ?? "20", 10);
/** Maximum sources to process per tick (keep tick fast) */
const MAX_SOURCES = parseInt(process.env.INGEST_MAX_SOURCES ?? "20", 10);

/**
 * Normalize a title into a dedup fingerprint.
 * Lowercases, removes punctuation/accents, collapses whitespace, keeps first 60 chars.
 */
function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accent marks
    .replace(/[^a-z0-9\s]/g, " ")    // remove punctuation
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function ingest(): Promise<{ ingested: number; skipped: number; errors: number }> {
  const allSources = await sourcesRepo.getEnabledSources();

  // Sort: hot before normal, then rss before html (RSS is more reliable from containers)
  allSources.sort((a, b) => {
    const prio = (s: Source) => (s.priority === "hot" ? 0 : 1);
    const typ = (s: Source) => (s.type === "rss" ? 0 : 1);
    return prio(a) - prio(b) || typ(a) - typ(b);
  });

  const sources = allSources.slice(0, MAX_SOURCES);

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  // Track title fingerprints within this tick to skip near-duplicates across sources
  const seenFingerprints = new Set<string>();

  for (const source of sources) {
    try {
      const rawEntries = await fetchSource(source);
      const batch = rawEntries.slice(0, PER_SOURCE_LIMIT);

      for (const entry of batch) {
        try {
          // Skip near-duplicate titles seen in this same ingest run
          const fp = titleFingerprint(entry.title);
          if (fp.length > 10 && seenFingerprints.has(fp)) {
            skipped++;
            continue;
          }
          seenFingerprints.add(fp);

          const hash = computeHash(entry.url, entry.title);

          const result = await rawItemsRepo.addRawItemIfNew({
            sourceId: source.id,
            hash,
            title: entry.title,
            url: entry.url,
            description: entry.description,
            publishedAt: entry.publishedAt
              ? Timestamp.fromDate(entry.publishedAt)
              : null,
            status: "new" as RawItemStatus,
            ...(entry.publisherUrl ? { publisherUrl: entry.publisherUrl } : {}),
          });

          if (result.created) {
            ingested++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.error(`[ingest] error adding item "${entry.title}":`, err);
          errors++;
        }
      }
    } catch (err) {
      console.error(`[ingest] error fetching source ${source.id} (${source.name}):`, err);
      errors++;
    }
  }

  console.log(`[ingest] ingested=${ingested} skipped=${skipped} errors=${errors} (from ${sources.length} sources)`);
  return { ingested, skipped, errors };
}

async function fetchSource(
  source: Source,
): Promise<{ title: string; url: string; description: string; publisherUrl?: string; publishedAt: Date | null }[]> {
  if (source.type === "rss") {
    const items = await fetchRSS(source.url);
    // For Google News items that have a resolved publisher URL,
    // keep the GN link as-is but let process step use extractOriginalUrl.
    // The title is already cleaned (publisher suffix removed by fetchRSS).
    return items;
  }

  if (source.type === "html") {
    const selector = source.selectors?.listItem ?? source.selector;
    if (!selector) {
      console.warn(`[ingest] HTML source ${source.id} has no list selector`);
      return [];
    }
    const items = await scrapeHTML(source.url, selector);
    return items.map((i) => ({ ...i, publishedAt: null }));
  }

  console.warn(`[ingest] unsupported source type for ${source.id}`);
  return [];
}
