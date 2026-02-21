/**
 * Image generation job — runs as Step 5 of the /tick pipeline.
 *
 * For each item that needs an image:
 * 1. Try to screenshot the source article page (real visual content)
 * 2. Fall back to a branded card (for social media use)
 *
 * Bounded work per tick so it never blocks the pipeline.
 */

import { itemsRepo, uploadImageBuffer } from "@edlight-news/firebase";
import {
  renderBrandedCardPNG,
  screenshotHeroImage,
} from "@edlight-news/renderer";

const IMAGE_BATCH_LIMIT = parseInt(
  process.env.IMAGE_BATCH_LIMIT ?? "5",
  10,
);

/**
 * Query items that have no image yet (imageSource is undefined)
 * and generate images for them.
 */
export async function generateImages(): Promise<{
  generated: number;
  screenshotted: number;
  failed: number;
}> {
  let generated = 0;
  let screenshotted = 0;
  let failed = 0;

  const candidates = await itemsRepo.listItemsNeedingImages(IMAGE_BATCH_LIMIT);

  if (candidates.length === 0) {
    return { generated: 0, screenshotted: 0, failed: 0 };
  }

  console.log(`[images] ${candidates.length} items need images`);

  for (const item of candidates) {
    try {
      // ── Strategy 1: Screenshot the source article page ──────────────
      const sourceUrl =
        item.source?.originalUrl ??
        item.citations?.[0]?.sourceUrl ??
        item.canonicalUrl;

      if (sourceUrl) {
        const screenshotBuffer = await screenshotHeroImage(sourceUrl);
        if (screenshotBuffer) {
          const storagePath = `images/items/${item.id}_screenshot.png`;
          const publicUrl = await uploadImageBuffer(storagePath, screenshotBuffer);

          await itemsRepo.updateItem(item.id, {
            imageUrl: publicUrl,
            imageSource: "screenshot",
            imageMeta: {
              width: 1200,
              height: 630,
              fetchedAt: new Date().toISOString(),
              originalImageUrl: sourceUrl,
            },
          });

          screenshotted++;
          console.log(`[images] screenshot for item ${item.id} from ${sourceUrl}`);
          continue; // next item
        }
      }

      // ── Strategy 2: Branded card (for social media) ─────────────────
      const pubAt = item.publishedAt as
        | { seconds?: number; _seconds?: number }
        | null
        | undefined;
      const pubSecs =
        pubAt?.seconds ??
        (pubAt as Record<string, number> | null)?._seconds;
      const dateStr = pubSecs
        ? new Date(pubSecs * 1000).toISOString().slice(0, 10)
        : undefined;

      const pngBuffer = await renderBrandedCardPNG({
        title: item.title,
        category: item.category,
        sourceName: item.source?.name ?? item.citations?.[0]?.sourceName,
        date: dateStr,
      });

      const storagePath = `images/items/${item.id}.png`;
      const publicUrl = await uploadImageBuffer(storagePath, pngBuffer);

      await itemsRepo.updateItem(item.id, {
        imageUrl: publicUrl,
        imageSource: "generated",
        imageMeta: {
          width: 1080,
          height: 1080,
          fetchedAt: new Date().toISOString(),
        },
      });

      generated++;
      console.log(`[images] generated branded card for item ${item.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[images] failed for item ${item.id}: ${msg}`);

      // Mark as fallback so we don't retry endlessly
      try {
        await itemsRepo.updateItem(item.id, { imageSource: "fallback" });
      } catch {
        // ignore
      }

      failed++;
    }
  }

  console.log(
    `[images] screenshotted=${screenshotted} generated=${generated} failed=${failed}`,
  );
  return { generated, screenshotted, failed };
}

