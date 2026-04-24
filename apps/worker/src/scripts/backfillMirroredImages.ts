/**
 * One-time Firestore migration: mirror existing publisher images into our
 * own Firebase Storage bucket.
 *
 * Scans items where imageSource === "publisher" and imageUrl points at an
 * external host (i.e. not already a firebasestorage.googleapis.com /
 * storage.googleapis.com URL), downloads the image, uploads it to Storage,
 * and updates the item with the mirrored URL. Original URL is preserved in
 * imageMeta.originalImageUrl for attribution.
 *
 * Usage:
 *   pnpm tsx apps/worker/src/scripts/backfillMirroredImages.ts                 # live writes
 *   BACKFILL_DRY_RUN=true pnpm tsx apps/worker/src/scripts/backfillMirroredImages.ts
 *   BACKFILL_LIMIT=50    pnpm tsx apps/worker/src/scripts/backfillMirroredImages.ts
 *
 * Safe to re-run — idempotent (mirror helper is content-addressed by URL hash,
 * and items already pointing at firebasestorage.googleapis.com are skipped).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, itemsRepo } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";
import {
  mirrorPublisherImage,
  isAlreadyMirrored,
} from "../services/mirrorPublisherImage.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
const LIMIT = process.env.BACKFILL_LIMIT
  ? parseInt(process.env.BACKFILL_LIMIT, 10)
  : Number.POSITIVE_INFINITY;
const SLEEP_MS = parseInt(process.env.BACKFILL_SLEEP_MS ?? "150", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function run(): Promise<void> {
  console.log(
    `[backfill] starting${DRY_RUN ? " (DRY RUN)" : ""} — limit=${LIMIT === Infinity ? "all" : LIMIT}`,
  );

  const snap = await getDb()
    .collection("items")
    .where("imageSource", "==", "publisher")
    .get();

  console.log(`[backfill] scanned ${snap.size} publisher-image items`);

  let scanned = 0;
  let alreadyMirrored = 0;
  let mirrored = 0;
  let failed = 0;
  let skippedNoUrl = 0;

  for (const doc of snap.docs) {
    if (mirrored >= LIMIT) {
      console.log(`[backfill] reached limit=${LIMIT}, stopping.`);
      break;
    }

    scanned++;
    const item = { id: doc.id, ...doc.data() } as Item;
    const url = item.imageUrl;

    if (!url) {
      skippedNoUrl++;
      continue;
    }
    if (isAlreadyMirrored(url)) {
      alreadyMirrored++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[backfill] would mirror ${item.id} ← ${url}`);
      mirrored++;
      continue;
    }

    const result = await mirrorPublisherImage(url);
    if (!result) {
      failed++;
      console.warn(`[backfill] mirror failed for ${item.id} (${url})`);
      continue;
    }

    // Preserve original URL for attribution; never overwrite if already set.
    const originalImageUrl = item.imageMeta?.originalImageUrl ?? url;

    await itemsRepo.updateItem(item.id, {
      imageUrl: result.url,
      imageMeta: {
        ...(item.imageMeta ?? {}),
        originalImageUrl,
        fetchedAt: new Date().toISOString(),
        ...(result.width ? { width: result.width } : {}),
        ...(result.height ? { height: result.height } : {}),
      },
    });

    mirrored++;
    console.log(
      `[backfill] mirrored ${item.id} (${result.bytes} B, ${result.contentType})`,
    );

    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }

  console.log(
    `[backfill] done — scanned=${scanned} mirrored=${mirrored} ` +
      `alreadyMirrored=${alreadyMirrored} failed=${failed} skippedNoUrl=${skippedNoUrl}`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  });
