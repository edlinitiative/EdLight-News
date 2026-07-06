/**
 * Seed the curated flagship scholarships into Firestore.
 *
 * These are ~20 hand-verified, Haiti-eligible flagship programmes with rich
 * detail (benefits, fields of study, application steps, key dates, etc.),
 * grounded in each programme's official page. Upserts by name so reruns are
 * idempotent and safe.
 *
 * Usage:  npx tsx src/scripts/seedFlagshipScholarships.ts
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { scholarshipsRepo } from "@edlight-news/firebase";
import type { CreateScholarship } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

const seedPath = path.resolve(__dirname, "../data/scholarships_seed_flagship.json");
const raw = fs.readFileSync(seedPath, "utf-8");
const SCHOLARSHIPS: CreateScholarship[] = JSON.parse(raw) as CreateScholarship[];

async function main() {
  console.log(`🎓 Seeding ${SCHOLARSHIPS.length} flagship scholarships…\n`);
  let created = 0;
  let updated = 0;
  for (const s of SCHOLARSHIPS) {
    const result = await scholarshipsRepo.upsertByName(s);
    if (result.created) {
      created++;
      console.log(`  ✅  created  ${s.name}`);
    } else {
      updated++;
      console.log(`  ♻️  updated  ${s.name}`);
    }
  }
  console.log(
    `\n🏁 Done — created: ${created}, updated: ${updated}, total: ${SCHOLARSHIPS.length}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
