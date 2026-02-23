/**
 * One-time fix: correct two factual errors in the Firestore almanac.
 *
 * 1. Jacques Roumain — update year from 1943 → 1944
 *    (Gouverneurs de la rosée published 1944, not 1943)
 *
 * 2. Alexandre Pétion 02-12 — delete the bogus "Naissance" entry
 *    (Pétion was born 2 April 1770, correctly in the 04-02 entry)
 *
 * Usage:  npx tsx src/scripts/fixAlmanacData.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

import { haitiHistoryAlmanacRepo } from "@edlight-news/firebase";

async function main() {
  console.log("🔧 Fixing almanac data in Firestore…\n");

  // ── Fix 1: Roumain year 1943 → 1944 ─────────────────────────────────────
  const roumainEntries = await haitiHistoryAlmanacRepo.listByMonthDay("02-23");
  const roumain = roumainEntries.find((e) =>
    e.title_fr.includes("Gouverneurs de la rosée"),
  );

  if (roumain) {
    await haitiHistoryAlmanacRepo.update(roumain.id, { year: 1944 });
    console.log(`  ✅ Roumain: year ${roumain.year} → 1944  (id: ${roumain.id})`);
  } else {
    console.log("  ⚠️  Roumain 02-23 entry not found — skipping");
  }

  // ── Fix 2: Delete bogus Pétion 02-12 "Naissance" entry ──────────────────
  const deleted = await haitiHistoryAlmanacRepo.removeByMonthDayAndTitle(
    "02-12",
    "Naissance d'Alexandre Pétion à Port-au-Prince",
  );

  if (deleted) {
    console.log("  ✅ Pétion 02-12 'Naissance' entry deleted");
  } else {
    console.log("  ⚠️  Pétion 02-12 entry not found — already removed?");
  }

  // ── Verify the correct Pétion 04-02 entry is still there ────────────────
  const petionCorrect = await haitiHistoryAlmanacRepo.listByMonthDay("04-02");
  const birthEntry = petionCorrect.find((e) =>
    e.title_fr.includes("Pétion"),
  );

  if (birthEntry) {
    console.log(`  ✅ Correct Pétion birth entry at 04-02 confirmed (year: ${birthEntry.year})`);
  } else {
    console.log("  ⚠️  No Pétion entry found at 04-02 — check manually");
  }

  console.log("\n🏁 Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fix failed:", err);
  process.exit(1);
});
