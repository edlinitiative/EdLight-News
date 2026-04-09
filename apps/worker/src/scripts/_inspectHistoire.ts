/**
 * Inspect a specific ig_queue item and list all histoire items in the queue.
 *
 * Usage: npx tsx src/scripts/_inspectHistoire.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo, getDb } from "@edlight-news/firebase";

const TARGET_ID = "11OM5uGZNytBOemylYoY";

async function main() {
  // ── Part 1: Deep-inspect the target queue item ──────────────────────
  console.log("=".repeat(80));
  console.log(`INSPECTING QUEUE ITEM: ${TARGET_ID}`);
  console.log("=".repeat(80));

  const item = await igQueueRepo.getIGQueueItem(TARGET_ID);
  if (!item) {
    console.log("❌ Item not found!");
    return;
  }

  // Metadata
  console.log("\n── METADATA ──");
  console.log("igType:", item.igType);
  console.log("sourceContentId:", item.sourceContentId);
  console.log("status:", item.status);
  console.log("score:", item.score);
  console.log("reasons:", item.reasons);
  console.log("targetPostDate:", (item as any).targetPostDate);
  console.log("createdAt:", item.createdAt);
  console.log("updatedAt:", item.updatedAt);
  console.log("scheduledFor:", (item as any).scheduledFor);
  console.log("igMediaId:", (item as any).igMediaId);

  // Full payload
  if (item.payload) {
    console.log("\n── PAYLOAD TOP-LEVEL ──");
    const { slides, ...rest } = item.payload;
    console.log(JSON.stringify(rest, null, 2));

    console.log(`\n── SLIDES (${slides.length} total) ──`);
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i]!;
      console.log(`\n--- Slide ${i} ---`);
      console.log("  layout:", (s as any).layout);
      console.log("  heading:", s.heading);
      console.log("  supportLine:", (s as any).supportLine);
      console.log("  bullets:", JSON.stringify(s.bullets, null, 4));
      console.log("  body:", (s as any).body);
      console.log("  backgroundImage:", s.backgroundImage?.slice(0, 120));
      // Print any other keys
      const knownKeys = new Set(["heading", "bullets", "layout", "supportLine", "body", "backgroundImage"]);
      for (const [k, v] of Object.entries(s)) {
        if (!knownKeys.has(k)) {
          console.log(`  ${k}:`, typeof v === "string" ? v.slice(0, 200) : v);
        }
      }
    }
  } else {
    console.log("\n❌ No payload on this item");
  }

  // ── Part 2: List all histoire items in the queue ──────────────────────
  console.log("\n" + "=".repeat(80));
  console.log("ALL HISTOIRE ITEMS IN QUEUE (any status)");
  console.log("=".repeat(80));

  const db = getDb();
  const histoireSnap = await db
    .collection("ig_queue")
    .where("igType", "==", "histoire")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();

  console.log(`\nFound ${histoireSnap.size} histoire queue items:\n`);
  for (const doc of histoireSnap.docs) {
    const d = doc.data();
    const createdMs = d.createdAt?.seconds ? d.createdAt.seconds * 1000 : 0;
    const createdDate = createdMs ? new Date(createdMs).toISOString() : "?";
    const coverHeading = d.payload?.slides?.[0]?.heading ?? "(no cover heading)";
    console.log(
      `  ${doc.id} | status=${d.status} | score=${d.score} | created=${createdDate}` +
      `\n    sourceContentId=${d.sourceContentId}` +
      `\n    targetPostDate=${d.targetPostDate ?? "none"}` +
      `\n    coverHeading: ${coverHeading.slice(0, 100)}` +
      `\n    slides: ${d.payload?.slides?.length ?? 0}`
    );
    console.log();
  }
}

main().catch(console.error);
