/**
 * Re-queue ALL histoire IG items with the current formatter.
 *
 * Finds every ig_queue doc with igType="histoire" (queued or scheduled)
 * and re-formats the payload using the updated buildHistoireCarousel.
 *
 * Usage: cd apps/worker && npx tsx src/scripts/requeueHistoire.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import {
  igQueueRepo,
  itemsRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import { formatForIG } from "@edlight-news/generator/ig/formatters/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import type { IGQueueItem } from "@edlight-news/types";
import { getDb } from "@edlight-news/firebase";

async function listHistoireQueue(): Promise<IGQueueItem[]> {
  const db = getDb();
  const snap = await db
    .collection("ig_queue")
    .where("igType", "==", "histoire")
    .where("status", "in", ["queued", "scheduled", "scheduled_ready_for_manual"])
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem);
}

async function main() {
  console.log("\n🔄 Re-queuing all histoire IG items with updated formatter…\n");

  const items = await listHistoireQueue();
  console.log(`  Found ${items.length} histoire items in queue.\n`);

  if (items.length === 0) {
    console.log("  Nothing to re-queue. Done.\n");
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const qItem of items) {
    try {
      // Fetch the source item
      const item = await itemsRepo.getItem(qItem.sourceContentId);
      if (!item) {
        console.log(`  ⚠️  ${qItem.id}: source item ${qItem.sourceContentId} not found, skipping`);
        continue;
      }

      // Fetch bilingual content
      let bi: BilingualText | undefined;
      try {
        const versions = await contentVersionsRepo.listByItemId(item.id);
        const fr = versions.find((v: any) => v.language === "fr");
        const ht = versions.find((v: any) => v.language === "ht");
        if (fr) {
          bi = {
            frTitle: fr.title,
            frSummary: fr.summary,
            htTitle: ht?.title,
            htSummary: ht?.summary,
            frSections: fr.sections as { heading: string; content: string }[] | undefined,
            frBody: fr.body || undefined,
          };
        }
      } catch {
        /* content_versions not found — format without bi */
      }

      // Re-format through current formatter
      const payload = formatForIG("histoire", item, bi ? { bi } : undefined);

      // Update the queue entry
      await igQueueRepo.setPayload(qItem.id, payload);
      if (qItem.status !== "queued") {
        await igQueueRepo.updateStatus(qItem.id, "queued");
      }

      console.log(
        `  ✅ ${qItem.id}: ${item.title.substring(0, 60)}… → ${payload.slides.length} slides`,
      );
      updated++;
    } catch (err: any) {
      console.error(`  ❌ ${qItem.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  Done: ${updated} updated, ${errors} errors.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
