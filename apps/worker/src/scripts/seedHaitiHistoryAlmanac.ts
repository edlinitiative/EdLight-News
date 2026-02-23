/**
 * Seed Haiti History Almanac entries into Firestore.
 *
 * Usage:  pnpm seed:haiti-history-almanac        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:haiti-history-almanac
 *
 * Upserts by monthDay + title_fr so reruns are idempotent.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { haitiHistoryAlmanacRepo } from "@edlight-news/firebase";
import type { CreateHaitiHistoryAlmanacEntry } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Load seed data ─────────────────────────────────────────────────────────

const seedPath = path.resolve(__dirname, "../data/haiti_history_seed.json");
const ENTRIES: CreateHaitiHistoryAlmanacEntry[] = JSON.parse(
  readFileSync(seedPath, "utf-8"),
);

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🇭🇹 Seeding ${ENTRIES.length} Haiti History Almanac entries…`);

  let created = 0;
  let updated = 0;

  for (const entry of ENTRIES) {
    try {
      const result = await haitiHistoryAlmanacRepo.upsertByTitle(entry);
      if (result.created) {
        created++;
        console.log(`  ✅ Created: ${entry.monthDay} — ${entry.title_fr}`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${entry.monthDay} — ${entry.title_fr}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${entry.monthDay} — ${entry.title_fr}`, err);
    }
  }

  console.log(`\n✅ Done: ${created} created, ${updated} updated (${ENTRIES.length} total)`);
  process.exit(0);
}

main();
