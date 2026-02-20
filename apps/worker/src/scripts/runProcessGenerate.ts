/**
 * Run just the process + generate steps directly (bypass slow ingest).
 * Usage: npx tsx src/scripts/runProcessGenerate.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });

import { processRawItems } from "../services/process.js";
import { generateForItems } from "../services/generate.js";

async function main() {
  console.log("=== Process Step ===");
  const processResult = await processRawItems();
  console.log(JSON.stringify(processResult, null, 2));

  console.log("\n=== Generate Step ===");
  const genResult = await generateForItems();
  console.log(JSON.stringify(genResult, null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
