/**
 * Firestore backfill: re-probe `imageMeta.width` / `imageMeta.height` for
 * items that were mirrored before the mirror started recording dimensions.
 *
 * Background: between Apr 22 (PR #15 introduced publisher-image mirroring)
 * and the dimension fix, every newly-ingested article was stored with
 * `imageSource: "publisher"` but no `width` / `height`. Downstream IG quality
 * gates (`isItemImageUsableForIG`) rejected those items because dimensions
 * were missing, which forced the carousel to fall through to keyword/tiered
 * substitution and could ship topical-but-wrong images.
 *
 * This script:
 *   - scans `items` where `imageSource === "publisher"`,
 *   - filters to those whose `imageMeta.width` is missing,
 *   - downloads the (already-mirrored) image with a HEAD-then-GET (cheap),
 *   - probes width/height with the shared `detectImageDimensions` helper,
 *   - writes `imageMeta.width` and `imageMeta.height` back to Firestore.
 *
 * Idempotent. Safe to re-run. Honors BACKFILL_DRY_RUN / BACKFILL_LIMIT /
 * BACKFILL_SLEEP_MS for parity with backfillMirroredImages.ts.
 *
 * Usage:
 *   pnpm tsx apps/worker/src/scripts/backfillMirrorDimensions.ts
 *   BACKFILL_DRY_RUN=true pnpm tsx apps/worker/src/scripts/backfillMirrorDimensions.ts
 *   BACKFILL_LIMIT=200    pnpm tsx apps/worker/src/scripts/backfillMirrorDimensions.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, itemsRepo } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";
import { detectImageDimensions } from "../services/imageDimensions.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
const LIMIT = process.env.BACKFILL_LIMIT
  ? parseInt(process.env.BACKFILL_LIMIT, 10)
  : Number.POSITIVE_INFINITY;
const SLEEP_MS = parseInt(process.env.BACKFILL_SLEEP_MS ?? "100", 10);
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB cap, matches the mirror

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function downloadProbe(
  url: string,
): Promise<{ width?: number; height?: number; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    const dims = detectImageDimensions(buf, ct, url);
    return { ...dims, contentType: ct };
  } catch {
    return null;
  }
}

async function run(): Promise<void> {
  console.log(
    `[backfill-dims] starting${DRY_RUN ? " (DRY RUN)" : ""} — limit=${LIMIT === Infinity ? "all" : LIMIT}`,
  );

  // We can't filter by missing nested fields directly in Firestore, so pull
  // all publisher-source items and filter client-side. This collection is
  // bounded enough for a one-shot migration.
  const snap = await getDb()
    .collection("items")
    .where("imageSource", "==", "publisher")
    .get();

  console.log(`[backfill-dims] scanned ${snap.size} publisher-image items`);

  let scanned = 0;
  let alreadyOk = 0;
  let updated = 0;
  let failed = 0;
  let noUrl = 0;

  for (const doc of snap.docs) {
    if (updated >= LIMIT) {
      console.log(`[backfill-dims] reached limit=${LIMIT}, stopping.`);
      break;
    }
    scanned++;
    const item = { id: doc.id, ...doc.data() } as Item;
    const url = item.imageUrl;
    if (!url) {
      noUrl++;
      continue;
    }
    if (item.imageMeta?.width && item.imageMeta?.height) {
      alreadyOk++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[backfill-dims] would probe ${item.id} ← ${url}`);
      updated++;
      continue;
    }

    const probe = await downloadProbe(url);
    if (!probe || !probe.width || !probe.height) {
      failed++;
      console.warn(
        `[backfill-dims] could not probe ${item.id} (${url})${probe ? "" : " — fetch failed"}`,
      );
      continue;
    }

    await itemsRepo.updateItem(item.id, {
      imageMeta: {
        ...(item.imageMeta ?? {}),
        width: probe.width,
        height: probe.height,
      },
    });

    updated++;
    console.log(
      `[backfill-dims] ${item.id} ← ${probe.width}×${probe.height} (${probe.contentType})`,
    );

    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }

  console.log(
    `[backfill-dims] done — scanned=${scanned} updated=${updated} ` +
      `alreadyOk=${alreadyOk} failed=${failed} noUrl=${noUrl}`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-dims] fatal:", err);
    process.exit(1);
  });
