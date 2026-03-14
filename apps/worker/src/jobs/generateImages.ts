/**
 * Image pipeline job — runs as Step 5 of the /tick pipeline.
 *
 * For each item that needs an image, tries these strategies in order:
 * 1. Publisher image (og:image, twitter:image, JSON-LD) — already set in process step
 * 2. Wikidata portrait (for public personalities detected in title)
 * 3. Branded card (EdLight-styled gradient card)
 * 4. Screenshot fallback (smart article element screenshot)
 *
 * Bounded work per tick so it never blocks the pipeline.
 */

import { itemsRepo, uploadImageBuffer } from "@edlight-news/firebase";
import {
  renderBrandedCardPNG,
  screenshotArticleImage,
} from "@edlight-news/renderer";
import {
  fetchHtml,
  extractCandidateImages,
  pickBestImage,
} from "@edlight-news/scraper";
import type { Item, ImageSource, ImageAttribution, EntityRef } from "@edlight-news/types";
import { detectPersonName, fetchWikidataImage } from "../services/wikidata.js";

const IMAGE_BATCH_LIMIT = parseInt(
  process.env.IMAGE_BATCH_LIMIT ?? "5",
  10,
);

/** Minimum publisher-image confidence to accept (0-1). */
const PUBLISHER_CONFIDENCE_THRESHOLD = 0.6;

/** Minimum pixel width for publisher images to be used as IG backgrounds.
 *  We require extra headroom above 1080px to survive crop/zoom cleanly. */
const MIN_PUBLISHER_WIDTH = 1200;

/** Minimum shorter side to avoid blurry crop/zoom when using cover backgrounds. */
const MIN_PUBLISHER_SHORTEST_SIDE = 700;

export interface ImagePipelineResult {
  publisher: number;
  wikidata: number;
  branded: number;
  screenshotted: number;
  failed: number;
}

/**
 * Run the image pipeline for items that still need images.
 */
export async function generateImages(): Promise<ImagePipelineResult> {
  const result: ImagePipelineResult = {
    publisher: 0,
    wikidata: 0,
    branded: 0,
    screenshotted: 0,
    failed: 0,
  };

  const candidates = await itemsRepo.listItemsNeedingImages(IMAGE_BATCH_LIMIT);
  if (candidates.length === 0) return result;

  console.log(`[images] ${candidates.length} items need images`);

  for (const item of candidates) {
    try {
      const success = await processItemImage(item, result);
      if (!success) {
        // Mark as "branded" with fallback note so we don't retry endlessly
        await markFailed(item.id);
        result.failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[images] pipeline error for item ${item.id}: ${msg}`);
      await markFailed(item.id);
      result.failed++;
    }
  }

  console.log(
    `[images] publisher=${result.publisher} wikidata=${result.wikidata} branded=${result.branded} screenshot=${result.screenshotted} failed=${result.failed}`,
  );
  return result;
}

/**
 * Process a single item through the image pipeline.
 * Returns true if an image was successfully set.
 */
async function processItemImage(
  item: Item,
  result: ImagePipelineResult,
): Promise<boolean> {
  const sourceUrl =
    item.source?.originalUrl ??
    item.citations?.[0]?.sourceUrl ??
    item.canonicalUrl;

  // Track whether this is a stale re-process (old screenshot/fallback) to
  // avoid falling back to screenshot again at the end.
  const isReprocess = !!item.imageSource;

  // Snackable utility items (daily_fact, history) → publisher og:image and
  // screenshots are semantically unrelated to the fact topic.  Skip straight
  // to branded card for these.
  const BRANDED_ONLY_TYPES = new Set(["daily_fact", "history"]);
  const skipPublisherAndScreenshot =
    BRANDED_ONLY_TYPES.has(item.utilityMeta?.utilityType ?? "");

  // ── Strategy 1: Publisher image (fetch HTML → extract og:image etc.) ─
  if (sourceUrl && !skipPublisherAndScreenshot) {
    try {
      const html = await fetchHtml(sourceUrl);
      const candidates = extractCandidateImages(html, sourceUrl);
      const picked = pickBestImage(candidates);

      if (picked.url && picked.confidence >= PUBLISHER_CONFIDENCE_THRESHOLD) {
        const downloaded = await downloadImage(picked.url);
        if (downloaded && downloaded.buffer.length > 5_000) {
          // Reject low-resolution images that will look blurry on IG
          if (downloaded.width && downloaded.width < MIN_PUBLISHER_WIDTH) {
            console.warn(
              `[images] publisher image too small for ${item.id}: ${downloaded.width}px wide (min ${MIN_PUBLISHER_WIDTH}px)`,
            );
            // Fall through to next strategy
          } else if (downloaded.width && downloaded.height && Math.min(downloaded.width, downloaded.height) < MIN_PUBLISHER_SHORTEST_SIDE) {
            console.warn(
              `[images] publisher image too narrow for ${item.id}: ${downloaded.width}×${downloaded.height} (min shortest side ${MIN_PUBLISHER_SHORTEST_SIDE}px)`,
            );
          } else if (downloaded.width && downloaded.height && downloaded.width / Math.max(downloaded.height, 1) > 2.4) {
            console.warn(
              `[images] publisher image too panoramic for ${item.id}: ${downloaded.width}×${downloaded.height}`,
            );
          } else {
            const ext = picked.url.includes(".png") ? "png" : "jpg";
            const storagePath = `images/items/${item.id}_publisher.${ext}`;
            const publicUrl = await uploadImageBuffer(
              storagePath,
              downloaded.buffer,
              downloaded.contentType,
            );

            const meta: Record<string, unknown> = {
              fetchedAt: new Date().toISOString(),
              originalImageUrl: picked.url,
            };
            if (downloaded.width) meta.width = downloaded.width;
            if (downloaded.height) meta.height = downloaded.height;

            await itemsRepo.updateItem(item.id, {
              imageUrl: publicUrl,
              imageSource: "publisher" as ImageSource,
              imageConfidence: picked.confidence,
              imageMeta: meta as Item["imageMeta"],
            });

            result.publisher++;
            console.log(`[images] publisher image for item ${item.id} (confidence=${picked.confidence.toFixed(2)})`);
            return true;
          }
        }
      }
    } catch (err) {
      // HTML fetch or parse failed — continue to next strategy
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[images] publisher extraction failed for ${item.id}: ${msg}`);
    }
  }

  // ── Strategy 2: Wikidata portrait for public personalities ──────────
  const personName = detectPersonName(item.title, item.category);
  if (personName) {
    console.log(`[images] trying Wikidata for "${personName}" (item ${item.id})`);
    const wdResult = await fetchWikidataImage(personName);
    if (wdResult) {
      // Download the image and re-host to Firebase Storage
      const downloaded = await downloadImage(wdResult.imageUrl);
      if (downloaded) {
        const ext = wdResult.imageUrl.includes(".png") ? "png" : "jpg";
        const storagePath = `images/items/${item.id}_wikidata.${ext}`;
        const publicUrl = await uploadImageBuffer(
          storagePath,
          downloaded.buffer,
          downloaded.contentType,
        );

        await itemsRepo.updateItem(item.id, {
          imageUrl: publicUrl,
          imageSource: "wikidata" as ImageSource,
          imageConfidence: 0.85,
          imageMeta: {
            ...(downloaded.width ? { width: downloaded.width } : {}),
            ...(downloaded.height ? { height: downloaded.height } : {}),
            fetchedAt: new Date().toISOString(),
            originalImageUrl: wdResult.imageUrl,
          },
          imageAttribution: wdResult.attribution,
          entity: wdResult.entity,
        });

        result.wikidata++;
        console.log(`[images] Wikidata portrait for item ${item.id}: ${personName}`);
        return true;
      }
    }
  }

  // ── Strategy 3: Branded card ────────────────────────────────────────
  try {
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
      size: "landscape",
    });

    const storagePath = `images/items/${item.id}_branded.png`;
    const publicUrl = await uploadImageBuffer(storagePath, pngBuffer);

    await itemsRepo.updateItem(item.id, {
      imageUrl: publicUrl,
      imageSource: "branded" as ImageSource,
      imageConfidence: 1.0,
      imageMeta: {
        width: 1200,
        height: 630,
        fetchedAt: new Date().toISOString(),
      },
    });

    result.branded++;
    console.log(`[images] branded card for item ${item.id}`);
    return true;
  } catch (err) {
    console.warn(
      `[images] branded card failed for ${item.id}, trying screenshot:`,
      err instanceof Error ? err.message : err,
    );
  }

  // ── Strategy 4: Screenshot fallback ─────────────────────────────────
  // Skip if this item is being re-processed (already had a screenshot) to
  // avoid an infinite reprocessing loop.
  // Also skip for snackable utility items — screenshots of source pages are
  // not relevant to the fact topic.
  if (sourceUrl && !isReprocess && !skipPublisherAndScreenshot) {
    const screenshotResult = await screenshotArticleImage(sourceUrl);
    if (screenshotResult) {
      const storagePath = `images/items/${item.id}_screenshot.png`;
      const publicUrl = await uploadImageBuffer(
        storagePath,
        screenshotResult.buffer,
      );

      await itemsRepo.updateItem(item.id, {
        imageUrl: publicUrl,
        imageSource: "screenshot" as ImageSource,
        imageConfidence: 0.4,
        imageMeta: {
          width: screenshotResult.width,
          height: screenshotResult.height,
          fetchedAt: new Date().toISOString(),
          originalImageUrl: sourceUrl,
        },
      });

      result.screenshotted++;
      console.log(`[images] screenshot for item ${item.id}`);
      return true;
    }
  }

  return false;
}

/** Download an image from a URL. Returns buffer + content type + dimensions when detectable. */
async function downloadImage(
  url: string,
): Promise<{ buffer: Buffer; contentType: string; width?: number; height?: number } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org)",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Reject tiny responses (likely error pages)
    if (buffer.length < 1_000) return null;

    const dims = detectImageDimensions(buffer, contentType, url);
    return { buffer, contentType, ...dims };
  } catch {
    return null;
  }
}

function detectImageDimensions(
  buffer: Buffer,
  contentType: string,
  url?: string,
): { width?: number; height?: number } {
  return readPngSize(buffer)
    ?? readJpegSize(buffer)
    ?? readWebpSize(buffer)
    ?? readGifSize(buffer)
    ?? inferSizeFromUrl(url)
    ?? {};
}

function readPngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readGifSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const signature = buffer.toString("ascii", 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function readWebpSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  return null;
}

function readJpegSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    if (!marker) return null;

    if (marker === 0xd9 || marker === 0xda) break;
    const blockLength = buffer.readUInt16BE(offset + 2);
    if (blockLength < 2) return null;

    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + blockLength;
  }

  return null;
}

function inferSizeFromUrl(url?: string): { width?: number; height?: number } | null {
  if (!url) return null;
  const match = url.match(/(?:^|[^\d])(\d{3,4})[xX](\d{3,4})(?:[^\d]|$)/);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** Mark an item as having failed image processing so we don't retry forever. */
async function markFailed(itemId: string): Promise<void> {
  try {
    // Set imageSource to "branded" with null imageUrl to indicate processing was attempted
    await itemsRepo.updateItem(itemId, {
      imageSource: "branded" as ImageSource,
      imageConfidence: 0,
    });
  } catch {
    // ignore
  }
}
