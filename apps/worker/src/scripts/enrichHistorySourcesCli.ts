/**
 * CLI entry point: History Source Enrichment
 *
 * Finds wiki-only entries in haiti_history_almanac_raw and enriches them
 * with at least one non-Wikipedia reputable source via web search.
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker run enrich:history-sources
 *   pnpm --filter @edlight-news/worker run enrich:history-sources -- --limit=50
 *
 * Env vars required:
 *   GOOGLE_CSE_API_KEY — Google Custom Search JSON API key
 *   GOOGLE_CSE_CX      — Google Custom Search Engine ID
 */

import "dotenv/config";
import { enrichHistorySources } from "../jobs/enrichHistorySources.js";

function parseLimit(): number {
  const args = process.argv.slice(2);
  for (const arg of args) {
    const match = arg.match(/^--limit=(\d+)$/);
    if (match) return parseInt(match[1]!, 10);
  }
  return 50; // default
}

async function main() {
  const limit = parseLimit();
  console.log(`[enrich:history-sources] Starting enrichment (limit=${limit})...\n`);

  const result = await enrichHistorySources(limit);

  console.log(
    `\n[enrich:history-sources] Result: ${JSON.stringify(
      {
        processed: result.processed,
        enriched: result.enriched,
        skippedNoCandidate: result.skippedNoCandidate,
        skippedAlreadyHasSource: result.skippedAlreadyHasSource,
        errors: result.errors,
      },
      null,
      2,
    )}`,
  );

  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[enrich:history-sources] Fatal error:", err);
  process.exit(1);
});
