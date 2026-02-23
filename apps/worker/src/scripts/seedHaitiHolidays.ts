/**
 * Seed Haiti Holidays into Firestore.
 *
 * Usage:  pnpm seed:haiti-holidays        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:haiti-holidays
 *
 * Upserts by monthDay + name_fr so reruns are idempotent.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { haitiHolidaysRepo } from "@edlight-news/firebase";
import type { CreateHaitiHoliday } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Load seed data ─────────────────────────────────────────────────────────

const seedPath = path.resolve(__dirname, "../data/haiti_holidays_seed.json");
const HOLIDAYS: CreateHaitiHoliday[] = JSON.parse(
  readFileSync(seedPath, "utf-8"),
);

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🇭🇹 Seeding ${HOLIDAYS.length} Haiti Holidays…`);

  let created = 0;
  let updated = 0;

  for (const holiday of HOLIDAYS) {
    try {
      const result = await haitiHolidaysRepo.upsertByName(holiday);
      if (result.created) {
        created++;
        console.log(`  ✅ Created: ${holiday.monthDay} — ${holiday.name_fr}`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${holiday.monthDay} — ${holiday.name_fr}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${holiday.monthDay} — ${holiday.name_fr}`, err);
    }
  }

  console.log(`\n✅ Done: ${created} created, ${updated} updated (${HOLIDAYS.length} total)`);
  process.exit(0);
}

main();
