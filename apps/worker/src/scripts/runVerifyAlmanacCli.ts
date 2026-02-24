/**
 * CLI entry point: Almanac Verification
 *
 * Usage: pnpm --filter @edlight-news/worker run almanac:verify
 */

import "dotenv/config";
import { runVerifyAlmanacEntries } from "./verifyAlmanacEntry.js";

async function main() {
  console.log("[almanac:verify] Starting verification pass...\n");
  const result = await runVerifyAlmanacEntries();
  console.log("\n[almanac:verify] Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("[almanac:verify] Fatal error:", err);
  process.exit(1);
});
