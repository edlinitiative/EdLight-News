/**
 * CLI entry point: Almanac Coverage Stats
 *
 * Usage: pnpm --filter @edlight-news/worker run almanac:coverage
 */

import "dotenv/config";
import {
  getAlmanacCoverageStats,
  printCoverageStats,
} from "../historySources/coverageStats.js";

async function main() {
  const stats = await getAlmanacCoverageStats();
  printCoverageStats(stats);
  process.exit(0);
}

main().catch((err) => {
  console.error("[almanac:coverage] Fatal error:", err);
  process.exit(1);
});
