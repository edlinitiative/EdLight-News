/**
 * testReverseImageSearch.ts — Test the metadata-based HQ image finder
 * against real items from Firestore.
 *
 * Fetches recent IG queue items (posted/queued), loads their source items,
 * and runs findHighResVersion() on each to see if a better image exists.
 *
 * Usage:
 *   npx tsx src/scripts/testReverseImageSearch.ts
 *   npx tsx src/scripts/testReverseImageSearch.ts --limit 5
 *   npx tsx src/scripts/testReverseImageSearch.ts --id yYV9kaeLzknGsVvZH2kl
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { itemsRepo, igQueueRepo } from "@edlight-news/firebase";
import { findHighResVersion } from "../services/reverseImageSearch.js";
import type { Item } from "@edlight-news/types";

// ── Parse CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let specificId: string | null = null;
let limit = 10;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--id" && args[i + 1]) {
    specificId = args[i + 1]!;
    i++;
  } else if (args[i] === "--limit" && args[i + 1]) {
    limit = parseInt(args[i + 1]!, 10);
    i++;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string | null | undefined, maxLen = 60): string {
  if (!s) return "—";
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function dimStr(s: Item): string {
  const w = s.imageMeta?.width;
  const h = s.imageMeta?.height;
  if (w && h) return `${w}×${h}`;
  return "unknown";
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("━".repeat(80));
  console.log("  HQ Image Search Test — metadata-based (no Gemini Vision)");
  console.log("━".repeat(80));

  let items: Item[] = [];

  if (specificId) {
    // Test a single item by ID
    const item = await itemsRepo.getItem(specificId);
    if (!item) {
      console.error(`❌ Item ${specificId} not found`);
      process.exit(1);
    }
    items = [item];
    console.log(`\nTesting single item: ${specificId}\n`);
  } else {
    // Get recent queued IG items and look up their source items
    console.log(`\nFetching ${limit} recent IG queue items…\n`);

    const queueItems = await igQueueRepo.listByStatus("queued", limit);
    // Also grab some posted ones for comparison
    const postedItems = await igQueueRepo.listRecentPosted(7, limit);
    const allQueue = [...queueItems, ...postedItems].slice(0, limit);

    if (allQueue.length === 0) {
      console.log("No IG queue items found. Try --id <itemId> instead.");
      process.exit(0);
    }

    console.log(`Found ${allQueue.length} IG queue items. Looking up source items…\n`);

    for (const q of allQueue) {
      const item = await itemsRepo.getItem(q.sourceContentId);
      if (item) items.push(item);
    }
  }

  console.log(`Testing ${items.length} items:\n`);

  let found = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const item of items) {
    const title = truncate(item.title, 55);
    const entity = item.entity?.personName ?? "—";
    const dims = dimStr(item);
    const hasImage = !!item.imageUrl;

    console.log(`┌─ ${item.id}`);
    console.log(`│  Title:    ${title}`);
    console.log(`│  Entity:   ${entity}`);
    console.log(`│  Source:   ${item.source?.name ?? "—"}`);
    console.log(`│  Image:    ${hasImage ? truncate(item.imageUrl, 70) : "NONE"}`);
    console.log(`│  Dims:     ${dims}`);

    if (!hasImage) {
      console.log(`│  ⏭  SKIP — no publisher image`);
      console.log(`└${"─".repeat(78)}`);
      skipped++;
      continue;
    }

    try {
      const start = Date.now();
      const result = await findHighResVersion(item);
      const elapsed = Date.now() - start;

      if (result) {
        found++;
        console.log(`│  ✅ FOUND — ${result.width}×${result.height} from ${result.sourceDomain}`);
        console.log(`│  Score:    ${result.score.toFixed(1)}`);
        console.log(`│  URL:      ${truncate(result.url, 70)}`);
        console.log(`│  Time:     ${elapsed}ms`);
      } else {
        noMatch++;
        console.log(`│  ⚠️  No HQ match found`);
        console.log(`│  Time:     ${elapsed}ms`);
      }
    } catch (err) {
      noMatch++;
      console.log(`│  ❌ ERROR: ${err instanceof Error ? err.message : err}`);
    }

    console.log(`└${"─".repeat(78)}`);

    // Small delay between Brave API calls
    if (items.indexOf(item) < items.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n${"━".repeat(80)}`);
  console.log(`  Results: ${found} found | ${noMatch} no match | ${skipped} skipped`);
  console.log(`  Total items tested: ${items.length}`);
  console.log(`${"━".repeat(80)}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
