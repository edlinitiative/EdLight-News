/**
 * CLI entry point: Almanac Expansion
 *
 * Usage: pnpm --filter @edlight-news/worker run almanac:expand
 */

import "dotenv/config";
import { runAlmanacExpansion } from "./runAlmanacExpansion.js";

async function main() {
  console.log("[almanac:expand] Starting almanac expansion...\n");
  const result = await runAlmanacExpansion();
  console.log("\n[almanac:expand] Result:", JSON.stringify(result, null, 2));
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[almanac:expand] Fatal error:", err);
  process.exit(1);
});
