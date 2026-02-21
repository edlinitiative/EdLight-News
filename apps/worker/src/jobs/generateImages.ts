/**
 * Image generation job — runs as Step 5 of the /tick pipeline.
 *
 * Picks up to IMAGE_BATCH_LIMIT items that have no image yet,
 * renders a branded card for each, uploads to Firebase Storage,
 * and updates the item document.
 *
 * Bounded work per tick so it never blocks the pipeline.
 */

import { itemsRepo, uploadImageBuffer } from "@edlight-news/firebase";
import { renderBrandedCardPNG } from "@edlight-news/renderer";

const IMAGE_BATCH_LIMIT = parseInt(
  process.env.IMAGE_BATCH_LIMIT ?? "5",
  10,
);

/**
 * Query items that have no image yet (imageSource is undefined)
 * and generate branded cards for them.
 */
export async function generateImages(): Promise<{
  generated: number;
  failed: number;
}> {
  let generated = 0;
  let failed = 0;

  const candidates = await itemsRepo.listItemsNeedingImages(IMAGE_BATCH_LIMIT);

  if (candidates.length === 0) {
    return { generated: 0, failed: 0 };
  }

  console.log(`[images] ${candidates.length} items need images`);

  for (const item of candidates) {
    try {
      // Parse date for the card
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

      // Render the branded card
      const pngBuffer = await renderBrandedCardPNG({
        title: item.title,
        category: item.category,
        sourceName: item.source?.name ?? item.citations?.[0]?.sourceName,
        date: dateStr,
      });

      // Upload to Firebase Storage
      const storagePath = `images/items/${item.id}.png`;
      const publicUrl = await uploadImageBuffer(storagePath, pngBuffer);

      // Update the item with the image URL
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
      console.log(`[images] generated image for item ${item.id}`);
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

  console.log(`[images] generated=${generated} failed=${failed}`);
  return { generated, failed };
}

