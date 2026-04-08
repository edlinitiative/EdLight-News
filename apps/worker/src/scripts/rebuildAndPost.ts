/**
 * rebuildAndPost.ts — rebuild an IG queue item's payload with the current
 * formatter, then immediately post it. Used to test formatter changes.
 *
 * Usage: npx tsx src/scripts/rebuildAndPost.ts <itemId>
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo, itemsRepo, contentVersionsRepo } from "@edlight-news/firebase";
import { formatForIG } from "@edlight-news/generator/ig/index.js";
import { processIgScheduled } from "../jobs/processIgScheduled.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";

const [, , itemId] = process.argv;
if (!itemId) {
  console.error("Usage: npx tsx src/scripts/rebuildAndPost.ts <itemId>");
  process.exit(1);
}

async function main() {
  const queueItem = await igQueueRepo.getIGQueueItem(itemId!);
  if (!queueItem) {
    console.error(`Item ${itemId} not found in ig_queue`);
    process.exit(1);
  }
  console.log(`[rebuildAndPost] item: ${queueItem.id} type=${queueItem.igType} sourceContentId=${queueItem.sourceContentId}`);

  // Fetch source item and its latest FR content version
  const item = await itemsRepo.getItem(queueItem.sourceContentId);
  if (!item) {
    console.error(`Source item ${queueItem.sourceContentId} not found`);
    process.exit(1);
  }

  const versions = await contentVersionsRepo.listByItemId(item.id);
  const fr = versions.find((v) => v.language === "fr");
  const ht = versions.find((v) => v.language === "ht");
  let bi: BilingualText | undefined;
  if (fr) {
    bi = {
      frTitle: fr.title,
      frSummary: fr.summary,
      htTitle: ht?.title,
      htSummary: ht?.summary,
      frSections: fr.sections as { heading: string; content: string }[] | undefined,
      frBody: fr.body || undefined,
      frNarrative: fr.narrative ?? undefined,
    };
    console.log(`[rebuildAndPost] using version ${fr.id} (frNarrative=${!!bi.frNarrative}, frSections=${bi.frSections?.length ?? 0})`);
  }

  // Re-run the formatter with the NEW code
  const newPayload = await formatForIG(queueItem.igType, item, bi);
  if (!newPayload.slides || newPayload.slides.length === 0) {
    console.error("[rebuildAndPost] formatter produced empty slides — aborting");
    process.exit(1);
  }

  // Log the slides so we can inspect them
  console.log("\n[rebuildAndPost] ===== NEW SLIDE CONTENT =====");
  newPayload.slides.forEach((slide, idx) => {
    console.log(`\nSlide ${idx + 1} [${slide.layout ?? "?"}]`);
    console.log(`  heading (${slide.heading.length}c): ${slide.heading}`);
    slide.bullets.forEach((b, bi) => {
      console.log(`  bullet ${bi + 1} (${b.length}c): ${b}`);
    });
  });
  console.log("=====\n");

  // Persist the new payload and set status to scheduled (due now)
  await igQueueRepo.setPayload(queueItem.id, newPayload);
  const nowMinus1 = new Date(Date.now() - 60_000).toISOString();
  await igQueueRepo.setScheduled(queueItem.id, nowMinus1);
  console.log(`[rebuildAndPost] payload updated, scheduled to ${nowMinus1}`);

  // Post it
  const result = await processIgScheduled();
  console.log("[rebuildAndPost] post result:", result);

  if (result.posted > 0) {
    console.log(`\n✅ Posted!`);
  } else {
    console.log(`\n❌ Not posted — errors=${result.errors}`);
  }
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
