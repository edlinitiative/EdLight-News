/**
 * One-off: run buildIgQueue to pick up the freshly published histoire item.
 * Usage: npx tsx apps/worker/src/scripts/_runBuildIgQueue.ts
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

import { buildIgQueue } from "../jobs/buildIgQueue.js";

async function main() {
  console.log("Running buildIgQueue…");
  const result = await buildIgQueue();
  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
