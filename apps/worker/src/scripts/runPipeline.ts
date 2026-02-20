/**
 * Run the full pipeline: ingest → process → generate.
 * Usage: npx tsx src/scripts/runPipeline.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { ingest } from "../services/ingest.js";
import { processRawItems } from "../services/process.js";
import { generateForItems } from "../services/generate.js";

async function main() {
  console.log("=== Ingest Step ===");
  const ingestResult = await ingest();
  console.log(JSON.stringify(ingestResult, null, 2));

  console.log("\n=== Process Step ===");
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
