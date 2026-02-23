/**
 * Seed CA/FR/UK scholarships from JSON into Firestore.
 *
 * Usage:  pnpm seed:scholarships-ca-fr-uk    (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:scholarships-ca-fr-uk
 *
 * Upserts by name so reruns are idempotent.
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

// ── Load seed data ─────────────────────────────────────────────────────────

const seedPath = path.resolve(__dirname, "../data/scholarships_seed_ca_fr_uk.json");
const raw = fs.readFileSync(seedPath, "utf-8");
const SCHOLARSHIPS: CreateScholarship[] = JSON.parse(raw) as CreateScholarship[];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🎓 Seeding ${SCHOLARSHIPS.length} CA/FR/UK scholarships…\n`);

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
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
