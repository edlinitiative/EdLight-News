/**
 * reRenderFonts — Re-render all queued/scheduled IG posts with new two-font system.
 *
 * The font upgrade (DM Sans headlines + Inter body) changed the renderer
 * templates. Posts still in the pipeline need their pre-rendered PNGs
 * regenerated so they publish with the new typography.
 *
 * What this script does:
 *   1. Lists all active items from ig_queue (queued/scheduled/rendering/scheduled_ready_for_manual)
 *   2. Lists all active items from ig_story_queue (queued)
 *   3. Re-renders each item via Playwright with the updated font templates
 *   4. Re-uploads PNGs to Firebase Storage (overwriting old images)
 *   5. Prints a summary of what was re-rendered
 *
 * Usage:
 *   cd apps/worker && pnpm exec tsx src/scripts/reRenderFonts.ts
 *   cd apps/worker && pnpm exec tsx src/scripts/reRenderFonts.ts --dry-run
 */
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import {
  getDb,
  igQueueRepo,
  igStoryQueueRepo,
  uploadCarouselSlides,
  uploadStorySlide,
} from "@edlight-news/firebase";
import { renderWithIgEngine } from "@edlight-news/renderer/ig-engine-render.js";
import { generateStoryAssets } from "@edlight-news/renderer/ig-story.js";
import type { IGQueueItem, IGStoryQueueItem, IGQueueStatus, IGStoryQueueStatus } from "@edlight-news/types";

// ── Config ────────────────────────────────────────────────────────────────

const CAROUSEL_STATUSES: IGQueueStatus[] = [
  "queued",
  "scheduled",
  "rendering",
  "scheduled_ready_for_manual",
];

const STORY_STATUSES: IGStoryQueueStatus[] = ["queued"];

const DRY_RUN = process.argv.includes("--dry-run");

// ── Helpers ───────────────────────────────────────────────────────────────

interface RenderResult {
  id: string;
  collection: string;
  slideCount: number;
  uploaded: boolean;
  error?: string;
}

async function fetchCarouselItems(): Promise<IGQueueItem[]> {
  const db = getDb();
  const snap = await db.collection("ig_queue").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem)
    .filter((d) => CAROUSEL_STATUSES.includes(d.status));
}

async function fetchStoryItems(): Promise<IGStoryQueueItem[]> {
  const db = getDb();
  const snap = await db.collection("ig_story_queue").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as IGStoryQueueItem)
    .filter((d) => STORY_STATUSES.includes(d.status));
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔤 Re-Render Fonts — DM Sans + Inter upgrade`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no uploads)" : "LIVE (will re-upload PNGs)"}\n`);

  const [carouselItems, storyItems] = await Promise.all([
    fetchCarouselItems(),
    fetchStoryItems(),
  ]);

  console.log(`📋 Found ${carouselItems.length} carousel items (${CAROUSEL_STATUSES.join("/")})`);
  console.log(`📋 Found ${storyItems.length} story items (${STORY_STATUSES.join("/")})\n`);

  const results: RenderResult[] = [];

  // ── Carousel posts ────────────────────────────────────────────────────

  for (const item of carouselItems) {
    const title = item.payload?.slides?.[0]?.heading ?? "(no title)";
    const shortTitle = title.length > 50 ? title.slice(0, 50) + "…" : title;
    process.stdout.write(`  🎠 [${item.status}] ${shortTitle} `);

    if (!item.payload) {
      console.log("⚠ No payload — skipped");
      results.push({ id: item.id, collection: "ig_queue", slideCount: 0, uploaded: false, error: "no payload" });
      continue;
    }

    try {
      const assets = await renderWithIgEngine(item, item.payload);
      const slideCount = assets.slidePaths.length;

      if (DRY_RUN) {
        console.log(`✅ ${slideCount} slides rendered (dry-run, not uploaded)`);
        results.push({ id: item.id, collection: "ig_queue", slideCount, uploaded: false });
      } else {
        // Upload to Firebase Storage, overwriting any existing PNGs
        if (assets.mode === "rendered") {
          await uploadCarouselSlides(assets.slidePaths, item.id);
          console.log(`✅ ${slideCount} slides rendered & uploaded`);
          results.push({ id: item.id, collection: "ig_queue", slideCount, uploaded: true });
        } else {
          console.log(`⚠ Chromium unavailable — dry-run mode`);
          results.push({ id: item.id, collection: "ig_queue", slideCount, uploaded: false, error: "no chromium" });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ Error: ${msg}`);
      results.push({ id: item.id, collection: "ig_queue", slideCount: 0, uploaded: false, error: msg });
    }
  }

  // ── Story posts ───────────────────────────────────────────────────────

  for (const item of storyItems) {
    const title = item.payload?.slides?.[0]?.heading ?? "(no title)";
    const shortTitle = title.length > 50 ? title.slice(0, 50) + "…" : title;
    process.stdout.write(`  📖 [${item.status}] ${shortTitle} `);

    if (!item.payload) {
      console.log("⚠ No payload — skipped");
      results.push({ id: item.id, collection: "ig_story_queue", slideCount: 0, uploaded: false, error: "no payload" });
      continue;
    }

    try {
      const assets = await generateStoryAssets(item, item.payload);
      const slideCount = assets.slidePaths.length;

      if (DRY_RUN) {
        console.log(`✅ ${slideCount} frames rendered (dry-run, not uploaded)`);
        results.push({ id: item.id, collection: "ig_story_queue", slideCount, uploaded: false });
      } else {
        if (assets.mode === "rendered") {
          // Upload each frame
          for (let i = 0; i < assets.slidePaths.length; i++) {
            await uploadStorySlide(assets.slidePaths[i]!, item.id, i);
          }
          console.log(`✅ ${slideCount} frames rendered & uploaded`);
          results.push({ id: item.id, collection: "ig_story_queue", slideCount, uploaded: true });
        } else {
          console.log(`⚠ Chromium unavailable — dry-run mode`);
          results.push({ id: item.id, collection: "ig_story_queue", slideCount, uploaded: false, error: "no chromium" });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ Error: ${msg}`);
      results.push({ id: item.id, collection: "ig_story_queue", slideCount: 0, uploaded: false, error: msg });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────

  const totalItems = results.length;
  const rendered = results.filter((r) => r.slideCount > 0);
  const uploaded = results.filter((r) => r.uploaded);
  const errors = results.filter((r) => r.error);
  const totalSlides = results.reduce((acc, r) => acc + r.slideCount, 0);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 Re-Render Summary`);
  console.log(`   Total items:      ${totalItems}`);
  console.log(`   Rendered:         ${rendered.length} (${totalSlides} total slides/frames)`);
  console.log(`   Uploaded:         ${uploaded.length}`);
  console.log(`   Errors:           ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`     ❌ ${e.collection}/${e.id}: ${e.error}`);
    }
  }
  console.log(`${"═".repeat(60)}\n`);

  // Clean exit
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
