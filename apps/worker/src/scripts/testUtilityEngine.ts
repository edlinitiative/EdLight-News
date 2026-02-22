/**
 * Quick E2E smoke-test for the utility engine against live Firestore + Gemini.
 * Usage:  pnpm --filter @edlight-news/worker test:utility-engine
 */
import "dotenv/config";
import { runUtilityEngine } from "../services/utility.js";

async function main() {
  console.log("🔧 Starting utility engine E2E test…\n");
  const t0 = Date.now();

  const result = await runUtilityEngine();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Utility engine completed in ${elapsed}s`);
  console.log(JSON.stringify(result, null, 2));

  if (result.errors > 0) {
    console.warn(`\n⚠️  ${result.errors} error(s) encountered (check logs above for details)`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
