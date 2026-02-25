import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

import { runHistoryDailyPublisher } from "../services/historyPublisher";

async function main() {
  console.log("Testing history publisher...");
  const result = await runHistoryDailyPublisher();
  console.log("Result:", result);
  console.log("Done.");
  process.exit(0);
}

main().catch(console.error);
