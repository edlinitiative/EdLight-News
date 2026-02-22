/**
 * One-time backfill: parse publisher names from Google News item titles
 * and update source.name on existing items.
 *
 * Google News titles are formatted "Article Title - Publisher Name".
 * This script finds all items whose canonicalUrl is on news.google.com
 * and updates:
 *   - source.name → extracted publisher name (e.g. "Miami Herald")
 *   - title → cleaned title (publisher suffix stripped)
 *
 * Usage:
 *   pnpm backfill:gn-publishers                          # live writes
 *   BACKFILL_DRY_RUN=true pnpm backfill:gn-publishers    # log-only
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import { parseGoogleNewsTitle } from "@edlight-news/scraper";
import { isAggregatorUrl } from "../services/scoring.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";

async function main() {
  const db = getDb();
  const col = db.collection("items");

  console.log(`\n🔍 Querying all items to find Google News entries...\n`);

  const snap = await col.get();
  const allItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Filter to items whose canonicalUrl is an aggregator (Google News)
  const gnItems = allItems.filter((item: any) =>
    item.canonicalUrl && isAggregatorUrl(item.canonicalUrl)
  );

  console.log(`Found ${gnItems.length} Google News items out of ${allItems.length} total.\n`);

  if (gnItems.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const writer = db.bulkWriter();
  let updated = 0;
  let skipped = 0;

  for (const item of gnItems) {
    const raw: any = item;
    const originalTitle: string = raw.title ?? "";
    const currentSourceName: string = raw.source?.name ?? "";

    // Parse publisher from title suffix
    const { cleanTitle, publisherName } = parseGoogleNewsTitle(originalTitle);

    if (!publisherName) {
      console.log(`  ⏭  ${item.id} — no publisher suffix in title: "${originalTitle.slice(0, 60)}…"`);
      skipped++;
      continue;
    }

    // Check if already fixed (source.name matches extracted publisher)
    if (currentSourceName === publisherName) {
      skipped++;
      continue;
    }

    const updates: Record<string, unknown> = {
      "source.name": publisherName,
    };

    // Also fix the title if it still has the publisher suffix
    if (cleanTitle !== originalTitle && cleanTitle.length > 5) {
      updates["title"] = cleanTitle;
    }

    if (DRY_RUN) {
      console.log(`  🔍 [DRY] ${item.id}  source.name: "${currentSourceName}" → "${publisherName}"  title: "${cleanTitle.slice(0, 50)}…"`);
    } else {
      writer.update(col.doc(item.id), updates);
      console.log(`  ✏️  ${item.id}  source.name → "${publisherName}"`);
    }
    updated++;
  }

  if (!DRY_RUN) {
    await writer.close();
  }

  console.log(`\n🏁 Done — updated: ${updated}, skipped: ${skipped}, total GN items: ${gnItems.length}`);
  if (DRY_RUN) console.log("   (dry run — no writes performed)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
