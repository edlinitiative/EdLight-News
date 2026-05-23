/**
 * Seed sources into Firestore from docs/sources.seed.json.
 *
 * Usage:  pnpm seed:sources        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:sources
 *
 * Idempotent (doc IDs are SHA-256 of the URL).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { runSeedSources } from "../services/seedSources.js";

// ── Load .env from monorepo root ───────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

async function main(): Promise<void> {
  const summary = await runSeedSources();
  console.log(
    `🏁 Done — inserted: ${summary.inserted}, updated: ${summary.updated}, ` +
      `skipped: ${summary.skipped}, total: ${summary.total} ` +
      `(${summary.durationMs}ms)`,
  );
  if (summary.errors.length > 0) {
    console.warn(`⚠️  ${summary.errors.length} error(s):`);
    for (const e of summary.errors) console.warn(`   - ${e.url}: ${e.error}`);
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
