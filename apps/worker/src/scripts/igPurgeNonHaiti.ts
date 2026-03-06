/**
 * Purge non-Haiti-relevant queued IG items from Firestore.
 *
 * Scans all queued items, checks eligibility text + title for
 * Africa-only markers, and deletes matches.
 *
 * Usage:  cd apps/worker && npx tsx src/scripts/igPurgeNonHaiti.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo, itemsRepo } from "@edlight-news/firebase";

const NON_HAITI_BLOCKERS = [
  "african", "africain", "afrique", "africa",
  "nigerian", "kenyan", "south african", "ghanaian",
  "sub-saharan", "subsaharan", "sub saharan",
  "citizens of african", "pays africains",
  "ressortissants africains", "africains uniquement",
  "african union", "union africaine",
];

const HAITI_RELEVANT = [
  "haiti", "haïti", "ayiti",
  "all countries", "tous les pays",
  "worldwide", "international", "global",
  "caribbean", "caraïbes",
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function main() {
  console.log("=== Purge Non-Haiti IG Queue Items ===\n");

  const queued = await igQueueRepo.listQueuedByScore(200);
  console.log(`Found ${queued.length} queued items\n`);

  let purged = 0;

  for (const qItem of queued) {
    if (qItem.igType !== "scholarship" && qItem.igType !== "opportunity") continue;

    try {
      const item = await itemsRepo.getItem(qItem.sourceContentId);
      if (!item) continue;

      const eligText = (item.opportunity?.eligibility ?? []).join(" ");
      const combined = normalize(`${item.title} ${item.summary} ${eligText}`);

      const hasBlocker = NON_HAITI_BLOCKERS.some(b => combined.includes(normalize(b)));
      if (!hasBlocker) continue;

      const hasHaitiMention = HAITI_RELEVANT.some(h => combined.includes(normalize(h)));
      if (hasHaitiMention) continue;

      // This item is Africa-only — purge it
      console.log(`  PURGE: ${qItem.id} — "${item.title?.slice(0, 60)}..."`);
      await igQueueRepo.updateStatus(qItem.id, "skipped");
      purged++;
    } catch (err) {
      console.warn(`  Error checking ${qItem.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nPurged ${purged} non-Haiti items (marked as skipped)`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
