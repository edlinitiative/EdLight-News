/**
 * Enrich History Sources Job
 *
 * Finds haiti_history_almanac_raw entries that only cite Wikipedia
 * and enriches them with at least one non-Wikipedia reputable source.
 *
 * Enrichment adds sources only — does NOT change facts.
 *
 * Behaviour:
 *   1. Query entries where verificationStatus == "unverified" OR sourcePrimary
 *      is Wikipedia with no non-Wikipedia secondary source.
 *   2. For each entry, build 2–3 web search queries using title + year + Haiti.
 *   3. Find up to 3 candidate URLs via Google Custom Search API.
 *   4. Filter out low-quality domains, duplicates, paywalls.
 *   5. Keep the best 1–2 (prefer tier1 → tier2).
 *   6. Set sourceSecondary on the entry.
 *   7. Log results and failures.
 *
 * Safety:
 *   - If no tier1/tier2 source found, entry is left unchanged.
 *   - No facts are modified — only sourceSecondary and sourceType are touched.
 *
 * Env vars:
 *   GOOGLE_CSE_API_KEY — Google Custom Search JSON API key
 *   GOOGLE_CSE_CX      — Google Custom Search Engine ID
 *
 * Run:
 *   pnpm --filter @edlight-news/worker run enrich:history-sources -- --limit=50
 */

import { haitiHistoryAlmanacRawRepo } from "@edlight-news/firebase";
import type {
  HaitiHistoryAlmanacRaw,
  AlmanacRawSourceType,
} from "@edlight-news/types";
import {
  classifySource,
  isWikipedia,
  isEnrichmentQuality,
  compareTiers,
  type SourceTier,
} from "../historySources/sourceQuality.js";
import { classifyDomain } from "../historySources/historySourceRegistry.js";

// ── Configuration ────────────────────────────────────────────────────────────

const LOG_PREFIX = "[enrich-history]";

/** Maximum candidate URLs to fetch per search query. */
const CANDIDATES_PER_QUERY = 3;

/** Domains to skip even if they rank well (paywalls, user-content, etc.). */
const BLOCKED_DOMAINS: readonly string[] = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "reddit.com",
  "quora.com",
  "pinterest.com",
  "medium.com",      // paywall + user-generated
  "amazon.com",
  "books.google.com",
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface EnrichResult {
  processed: number;
  enriched: number;
  skippedNoCandidate: number;
  skippedAlreadyHasSource: number;
  errors: number;
  details: EnrichDecision[];
}

export interface EnrichDecision {
  entryId: string;
  title: string;
  outcome: "enriched" | "skipped" | "error";
  reason: string;
  addedSource?: { name: string; url: string };
}

interface SearchResult {
  title: string;
  url: string;
}

interface ScoredCandidate {
  url: string;
  title: string;
  tier: SourceTier;
}

// ── Entry selection ──────────────────────────────────────────────────────────

/**
 * Returns true if the entry needs enrichment:
 * - sourcePrimary is Wikipedia AND sourceSecondary is absent or also Wikipedia.
 */
function needsEnrichment(entry: HaitiHistoryAlmanacRaw): boolean {
  const primaryIsWiki = isWikipedia(entry.sourcePrimary.url);
  if (!primaryIsWiki) return false;

  // No secondary at all → needs enrichment
  if (!entry.sourceSecondary?.url) return true;

  // Secondary is also Wikipedia → still needs enrichment
  return isWikipedia(entry.sourceSecondary.url);
}

// ── Search query generation ──────────────────────────────────────────────────

/**
 * Build 2–3 search queries for a history entry.
 * Designed to surface institutional/academic results about the event.
 */
function buildSearchQueries(entry: HaitiHistoryAlmanacRaw): string[] {
  const { title, year } = entry;
  const queries: string[] = [];

  // Query 1: title + year + Haiti (most specific)
  queries.push(`${title} ${year} Haiti`);

  // Query 2: title + year + "histoire" for French-language academic results
  queries.push(`${title} ${year} histoire Haïti`);

  // Query 3: shorter variant to catch broader results
  // Use first ~6 words of title + year
  const shortTitle = title.split(/\s+/).slice(0, 6).join(" ");
  if (shortTitle !== title) {
    queries.push(`${shortTitle} ${year} Haiti history`);
  }

  return queries;
}

// ── Google Custom Search ─────────────────────────────────────────────────────

/**
 * Search Google Custom Search JSON API.
 * Returns an array of { title, url } results.
 *
 * Requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX env vars.
 */
async function googleSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    throw new Error(
      "Missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX environment variables. " +
      "Configure a Google Custom Search Engine to enable enrichment.",
    );
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(CANDIDATES_PER_QUERY));

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google CSE HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    items?: Array<{ title: string; link: string }>;
  };

  if (!data.items || data.items.length === 0) return [];

  return data.items.map((item) => ({
    title: item.title,
    url: item.link,
  }));
}

// ── Candidate filtering & ranking ────────────────────────────────────────────

/** Extract hostname from URL, lowercased. */
function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Check if URL is from a blocked domain. */
function isBlockedDomain(url: string): boolean {
  const host = hostname(url);
  if (!host) return true;
  return BLOCKED_DOMAINS.some(
    (d) => host === d || host.endsWith(`.${d}`),
  );
}

/**
 * Given a list of raw search results, filter and rank them.
 * Returns candidates sorted by tier (tier1 first).
 */
function rankCandidates(
  results: SearchResult[],
  existingUrls: Set<string>,
): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = [];

  for (const result of results) {
    // Skip duplicates
    if (existingUrls.has(result.url)) continue;

    // Skip blocked domains
    if (isBlockedDomain(result.url)) continue;

    // Skip Wikipedia
    if (isWikipedia(result.url)) continue;

    // Classify quality tier
    const tier = classifySource(result.url);
    if (tier && isEnrichmentQuality(tier)) {
      candidates.push({
        url: result.url,
        title: result.title,
        tier,
      });
    }
  }

  // Sort by tier quality (tier1 first)
  candidates.sort((a, b) => compareTiers(a.tier, b.tier));

  return candidates;
}

/**
 * Derive AlmanacRawSourceType from SourceTier for the new source.
 * This maps the enrichment tier back to the existing source type enum.
 */
function tierToSourceType(
  url: string,
  tier: SourceTier,
): AlmanacRawSourceType {
  // Try the existing domain classifier first (more specific)
  const domainType = classifyDomain(url);
  if (domainType) return domainType;

  // Fallback based on tier
  switch (tier) {
    case "tier1":
      return "institutional";
    case "tier2":
      return "press";
    default:
      return "reference";
  }
}

// ── Main enrichment logic ────────────────────────────────────────────────────

/**
 * Enrich a single entry by searching for non-Wikipedia sources.
 */
async function enrichEntry(
  entry: HaitiHistoryAlmanacRaw,
): Promise<EnrichDecision> {
  // Collect existing URLs for deduplication
  const existingUrls = new Set<string>();
  existingUrls.add(entry.sourcePrimary.url);
  if (entry.sourceSecondary?.url) {
    existingUrls.add(entry.sourceSecondary.url);
  }

  // Build search queries
  const queries = buildSearchQueries(entry);

  // Collect all search results
  const allResults: SearchResult[] = [];

  for (const query of queries) {
    try {
      const results = await googleSearch(query);
      allResults.push(...results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `${LOG_PREFIX} search error for "${entry.title}" query="${query}": ${msg}`,
      );
    }
  }

  if (allResults.length === 0) {
    return {
      entryId: entry.id,
      title: entry.title,
      outcome: "skipped",
      reason: "No search results returned",
    };
  }

  // Rank and filter candidates
  const candidates = rankCandidates(allResults, existingUrls);

  if (candidates.length === 0) {
    return {
      entryId: entry.id,
      title: entry.title,
      outcome: "skipped",
      reason: "No tier1/tier2 candidates found among search results",
    };
  }

  // Pick the best candidate (first after sorting)
  const best = candidates[0]!;

  // Derive a clean source name from the hostname
  const host = hostname(best.url) ?? "unknown";
  const sourceName = host.replace(/^www\./, "");

  // Determine the new source type for the entry
  const newSourceType = tierToSourceType(best.url, best.tier);

  // Update entry in Firestore: set sourceSecondary, update sourceType
  await haitiHistoryAlmanacRawRepo.update(entry.id, {
    sourceSecondary: { name: sourceName, url: best.url },
    sourceType: newSourceType,
  });

  return {
    entryId: entry.id,
    title: entry.title,
    outcome: "enriched",
    reason: `Added ${best.tier} source from ${sourceName}`,
    addedSource: { name: sourceName, url: best.url },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the history source enrichment job.
 *
 * @param limit Maximum number of entries to process (default 50).
 */
export async function enrichHistorySources(
  limit = 50,
): Promise<EnrichResult> {
  console.log(`${LOG_PREFIX} Starting enrichment (limit=${limit})...`);

  // Validate env vars early
  if (!process.env.GOOGLE_CSE_API_KEY || !process.env.GOOGLE_CSE_CX) {
    console.error(
      `${LOG_PREFIX} ❌ Missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX. ` +
      `Set these environment variables to enable web search enrichment.`,
    );
    return {
      processed: 0,
      enriched: 0,
      skippedNoCandidate: 0,
      skippedAlreadyHasSource: 0,
      errors: 1,
      details: [],
    };
  }

  const result: EnrichResult = {
    processed: 0,
    enriched: 0,
    skippedNoCandidate: 0,
    skippedAlreadyHasSource: 0,
    errors: 0,
    details: [],
  };

  // Fetch unverified entries (wiki-only entries are typically unverified)
  const unverified = await haitiHistoryAlmanacRawRepo.listUnverified();
  console.log(`${LOG_PREFIX} Found ${unverified.length} unverified entries`);

  // Filter to entries that actually need enrichment
  const candidates = unverified.filter(needsEnrichment);
  console.log(
    `${LOG_PREFIX} ${candidates.length} entries have wiki-only sources`,
  );

  // Track entries skipped because they already have a non-wiki source
  result.skippedAlreadyHasSource = unverified.length - candidates.length;

  // Apply limit
  const batch = candidates.slice(0, limit);
  console.log(`${LOG_PREFIX} Processing batch of ${batch.length} entries`);

  for (const entry of batch) {
    result.processed++;

    try {
      const decision = await enrichEntry(entry);
      result.details.push(decision);

      switch (decision.outcome) {
        case "enriched":
          result.enriched++;
          console.log(
            `${LOG_PREFIX} ✅ Enriched: "${entry.title}" — ${decision.reason}`,
          );
          break;
        case "skipped":
          result.skippedNoCandidate++;
          console.log(
            `${LOG_PREFIX} ⏩ Skipped: "${entry.title}" — ${decision.reason}`,
          );
          break;
        case "error":
          result.errors++;
          console.error(
            `${LOG_PREFIX} ❌ Error: "${entry.title}" — ${decision.reason}`,
          );
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors++;
      result.details.push({
        entryId: entry.id,
        title: entry.title,
        outcome: "error",
        reason: msg,
      });
      console.error(
        `${LOG_PREFIX} ❌ Unexpected error for "${entry.title}": ${msg}`,
      );
    }
  }

  // Summary
  console.log(
    `\n${LOG_PREFIX} Done: enriched=${result.enriched} skipped=${result.skippedNoCandidate} ` +
    `alreadyHasSource=${result.skippedAlreadyHasSource} errors=${result.errors} ` +
    `processed=${result.processed}/${candidates.length}`,
  );

  return result;
}
