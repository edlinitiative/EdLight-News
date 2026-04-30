/**
 * Backfill: Run discoverScholarships against ALL candidates instead of the
 * normal 5-per-tick limit.  This processes all 692 items with
 * vertical="opportunites" that have never been evaluated.
 *
 * Usage:
 *   npx tsx apps/worker/src/scripts/backfillDiscoverScholarships.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { discoverScholarships } from "../services/discoverScholarships.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BATCH_SIZE = 5;  // items evaluated per call
const GOAL = 700;       // safely above the 692 candidates

async function main() {
  let totalEvaluated = 0;
  let totalPromoted = 0;
  let totalRejected = 0;
  let totalFailed = 0;

  for (let i = 0; i < Math.ceil(GOAL / BATCH_SIZE); i++) {
    const result = await discoverScholarships();

    totalEvaluated += result.evaluated;
    totalPromoted += result.promoted;
    totalRejected += result.rejected;
    totalFailed += result.failed;

    console.log(
      `[backfill] tick ${i + 1}: evaluated=${result.evaluated} promoted=${result.promoted} rejected=${result.rejected} failed=${result.failed} | total: eval=${totalEvaluated} prom=${totalPromoted} rej=${totalRejected} fail=${totalFailed}`,
    );

    if (result.evaluated === 0) {
      console.log("[backfill] no more candidates — done");
      break;
    }
  }

  console.log(`\n[backfill] FINAL: evaluated=${totalEvaluated} promoted=${totalPromoted} rejected=${totalRejected} failed=${totalFailed}`);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});