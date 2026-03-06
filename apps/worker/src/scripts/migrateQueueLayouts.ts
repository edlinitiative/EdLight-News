/**
 * Migration script: backfill `layout` field on existing ig_queue items.
 *
 * Rules (match the formatter output):
 *   - Slide 0 → "headline"
 *   - scholarship / opportunity: non-cover slides → "explanation"
 *     (unless statValue is set → "data")
 *   - news / histoire / utility: all slides → "headline"
 *   - taux: left untouched (renderer already handles taux by igType)
 *
 * Also applies `shortenHeadline` to the cover heading for a cleaner look,
 * matching what the formatters now produce for new items.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo } from "@edlight-news/firebase";
import type { IGSlide, IGSlideLayout, IGFormattedPayload } from "@edlight-news/types";
import { shortenHeadline } from "@edlight-news/generator/ig/formatters/helpers.js";

function assignLayout(
  slide: IGSlide,
  index: number,
  igType: string,
): IGSlideLayout {
  // Already has explicit layout → keep it
  if (slide.layout) return slide.layout;

  // Cover slide is always headline
  if (index === 0) return "headline";

  // Scholarship / opportunity: inner slides are explanation, unless data
  if (igType === "scholarship" || igType === "opportunity") {
    if (slide.statValue) return "data";
    return "explanation";
  }

  // News / histoire / utility: every slide is a bold headline
  return "headline";
}

async function main() {
  // Fetch all queued items (any status)
  const all = await igQueueRepo.listAll();
  console.log(`Total ig_queue items: ${all.length}\n`);

  let updated = 0;
  let skipped = 0;
  let noPayload = 0;

  for (const item of all) {
    // Skip items that don't have a payload yet
    const payload = item.payload as IGFormattedPayload | undefined;
    if (!payload?.slides?.length) {
      noPayload++;
      continue;
    }

    // Skip taux — renderer handles them by igType already
    if (item.igType === "taux") {
      skipped++;
      continue;
    }

    let changed = false;

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const newLayout = assignLayout(slide, i, item.igType);

      if (slide.layout !== newLayout) {
        slide.layout = newLayout;
        changed = true;
      }

      // Shorten cover heading if it's too long (match new formatter behaviour)
      if (i === 0) {
        const maxWords = item.igType === "histoire" ? 8 : 10;
        const short = shortenHeadline(slide.heading, maxWords);
        if (short !== slide.heading) {
          slide.heading = short;
          changed = true;
        }
      }
    }

    if (changed) {
      await igQueueRepo.setPayload(item.id, payload);
      updated++;
      console.log(`  ✓ ${item.igType.padEnd(12)} ${item.id}  (${payload.slides.length} slides)`);
    } else {
      skipped++;
    }
  }

  console.log(`\n=== Migration complete ===`);
  console.log(`  Updated:    ${updated}`);
  console.log(`  Skipped:    ${skipped} (already migrated or taux)`);
  console.log(`  No payload: ${noPayload}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
