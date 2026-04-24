/**
 * One-shot script: upload all five CTA background images to Firebase Storage.
 *
 * CTA slides previously used live Wikipedia URLs for their background images.
 * If the worker container cannot reach Wikipedia at render time (network
 * restrictions, rate-limiting, or just latency) Playwright renders a plain
 * dark background — making the CTA slide look "broken".
 *
 * This script:
 *   1. Checks whether each image already exists at ig_assets/cta/{name}.jpg.
 *   2. If it does, reads back its existing download token (idempotent).
 *   3. If it does not, fetches from Wikipedia and uploads.
 *   4. Prints the final Firebase Storage URLs.
 *   5. Patches the five formatter source files in-place with those URLs.
 *
 * Usage (from apps/worker):
 *   npx tsx src/scripts/uploadCtaImages.ts
 *
 * Re-running is safe — existing images are not re-uploaded.
 * Add --dry-run to see what would happen without writing files.
 */
import path from "path";
import { readFileSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";

// Load .env from monorepo root (two levels up from apps/worker)
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getOrUploadImageBuffer } from "@edlight-news/firebase";

const DRY_RUN = process.argv.includes("--dry-run");

// ── CTA image definitions ─────────────────────────────────────────────────────

interface CtaImageDef {
  /** Firebase Storage path under ig_assets/cta/. */
  name: string;
  /** Original Wikipedia source URL. */
  sourceUrl: string;
  /** Absolute path to the formatter file that contains the constant. */
  formatterFile: string;
  /** The exact constant name to replace (both the key and string value). */
  constantName: string;
}

const MONOREPO_ROOT = path.resolve(process.cwd(), "../..");
const FORMATTERS_DIR = path.join(MONOREPO_ROOT, "packages/generator/src/ig/formatters");

const CTA_IMAGES: CtaImageDef[] = [
  {
    name: "news-cta",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Citadelle_Laferri%C3%A8re_Aerial_View.jpg/1280px-Citadelle_Laferri%C3%A8re_Aerial_View.jpg",
    formatterFile: path.join(FORMATTERS_DIR, "news.ts"),
    constantName: "NEWS_CTA_IMAGE",
  },
  {
    name: "opportunity-cta",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/View_of_Port-au-Prince_from_Hotel_Montana.jpg/1280px-View_of_Port-au-Prince_from_Hotel_Montana.jpg",
    formatterFile: path.join(FORMATTERS_DIR, "opportunity.ts"),
    constantName: "OPPORTUNITY_CTA_IMAGE",
  },
  {
    name: "scholarship-cta",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/MUPANAH_2018_-_Roof.jpg/1280px-MUPANAH_2018_-_Roof.jpg",
    formatterFile: path.join(FORMATTERS_DIR, "scholarship.ts"),
    constantName: "SCHOLARSHIP_CTA_IMAGE",
  },
  {
    name: "histoire-cta",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Sans-Souci_Palace_Haiti_%288070547181%29.jpg/1280px-Sans-Souci_Palace_Haiti_%288070547181%29.jpg",
    formatterFile: path.join(FORMATTERS_DIR, "histoire.ts"),
    constantName: "HISTOIRE_CTA_IMAGE",
  },
  {
    name: "utility-cta",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Central_Market%2C_Port-au-Prince.jpg/1280px-Central_Market%2C_Port-au-Prince.jpg",
    formatterFile: path.join(FORMATTERS_DIR, "utility.ts"),
    constantName: "UTILITY_CTA_IMAGE",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAsBuffer(url: string): Promise<Buffer> {
  console.log(`  ↓ Fetching ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "EdLight-News-Bot/1.0 (image-upload; https://news.edlight.org)",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Patch a formatter source file: replace the old string value of `constantName`
 * with `newUrl`.  Matches both single-line and multi-line (line-continuation)
 * constant assignments.
 */
function patchFormatterFile(
  filePath: string,
  constantName: string,
  newUrl: string,
): boolean {
  const src = readFileSync(filePath, "utf8");

  // Match:  const FOO_IMAGE =\n  "old-url";
  // OR:     const FOO_IMAGE = "old-url";
  const pattern = new RegExp(
    `(const ${constantName}\\s*=\\s*(?:\n\\s*)?")(https?://[^"]+)(")`,
    "m",
  );

  if (!pattern.test(src)) {
    console.warn(`  ⚠ Could not locate ${constantName} in ${filePath} — skipping patch.`);
    return false;
  }

  const patched = src.replace(pattern, `$1${newUrl}$3`);
  if (patched === src) {
    console.log(`  ✓ ${constantName} already set to the Firebase URL — no change.`);
    return false;
  }

  if (!DRY_RUN) {
    writeFileSync(filePath, patched, "utf8");
  }
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log("=== DRY RUN (files will not be modified) ===\n");

  const results: { name: string; url: string }[] = [];

  for (const def of CTA_IMAGES) {
    const storagePath = `ig_assets/cta/${def.name}.jpg`;
    console.log(`\n[${def.name}]`);
    console.log(`  Storage path : ${storagePath}`);

    const url = await getOrUploadImageBuffer(
      storagePath,
      () => fetchAsBuffer(def.sourceUrl),
      "image/jpeg",
    );

    console.log(`  Firebase URL : ${url}`);
    results.push({ name: def.name, url });

    // Patch the formatter source file
    const relative = path.relative(MONOREPO_ROOT, def.formatterFile);
    console.log(`  Patching     : ${relative}`);
    const changed = patchFormatterFile(def.formatterFile, def.constantName, url);
    if (changed && !DRY_RUN) console.log(`  ✓ Patched`);
    if (changed && DRY_RUN) console.log(`  ✓ Would patch (dry run)`);
  }

  console.log("\n=== Summary ===");
  for (const r of results) {
    console.log(`  ${r.name.padEnd(18)} ${r.url}`);
  }
  console.log("\nDone. Commit the patched formatter files.");
}

main().catch((err) => {
  console.error("[uploadCtaImages] Fatal:", err);
  process.exit(1);
});
