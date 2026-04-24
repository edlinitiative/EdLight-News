/**
 * Seed curated scholarships into Firestore.
 *
 * Loads from `apps/worker/src/data/scholarships_curated.json`.
 * Upserts by name so reruns are idempotent and safe.
 *
 * Usage:  pnpm seed:scholarships        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:scholarships
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scholarshipsRepo } from "@edlight-news/firebase";
import { createScholarshipSchema, type CreateScholarship } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Load curated dataset ────────────────────────────────────────────────────

const DATA_PATH = path.resolve(__dirname, "../data/scholarships_curated.json");

function loadScholarships(): CreateScholarship[] {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8")) as unknown[];
  if (!Array.isArray(raw)) {
    throw new Error(`Expected JSON array in ${DATA_PATH}`);
  }
  const parsed: CreateScholarship[] = [];
  raw.forEach((entry, idx) => {
    const result = createScholarshipSchema.safeParse(entry);
    if (!result.success) {
      const name =
        typeof entry === "object" && entry !== null && "name" in entry
          ? String((entry as { name: unknown }).name)
          : `index ${idx}`;
      console.error(`❌ Invalid scholarship "${name}":`);
      console.error(JSON.stringify(result.error.issues, null, 2));
      throw new Error(`Validation failed for scholarship "${name}"`);
    }
    parsed.push(result.data);
  });
  return parsed;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const scholarships = loadScholarships();
  console.log(`🎓 Seeding ${scholarships.length} curated scholarships from ${path.relative(monorepoRoot, DATA_PATH)}…\n`);

  let created = 0;
  let updated = 0;

  for (const s of scholarships) {
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
    `\n🏁 Done — created: ${created}, updated: ${updated}, total: ${scholarships.length}`,
  );
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
