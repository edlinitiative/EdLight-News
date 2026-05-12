/**
 * Run the cleanup passes once, locally.
 *
 * Usage:  cd apps/worker && npx tsx src/scripts/runCleanup.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { runCleanup } from "../services/cleanup.js";

async function main() {
  console.log("\n🧹  Running ig_queue + sibling-queue cleanup…\n");
  const summary = await runCleanup();
  console.log("\n✅ Cleanup complete:\n");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
