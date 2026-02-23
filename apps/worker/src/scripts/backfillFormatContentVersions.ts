/**
 * Backfill: apply formatContentVersion() to existing content_versions.
 *
 * Reads content_versions ordered by createdAt desc, runs the house-style
 * formatter, and updates documents whose formatted output differs from
 * what is already stored.
 *
 * Usage:
 *   pnpm backfill:format-content-versions                    # live (default limit 500)
 *   pnpm backfill:format-content-versions --limit=2000       # higher limit
 *   pnpm backfill:format-content-versions --dry-run          # log diffs, no writes
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";
import { itemsRepo } from "@edlight-news/firebase";
import {
  formatContentVersion,
  type FormatContentVersionInput,
} from "@edlight-news/generator";
import type { ContentVersion, ContentLanguage, Item } from "@edlight-news/types";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── CLI args ────────────────────────────────────────────────────────────────
function parseArgs(): { limit: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  let limit = 500;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      const v = parseInt(arg.split("=")[1]!, 10);
      if (!isNaN(v) && v > 0) limit = v;
    }
    if (arg === "--dry-run") dryRun = true;
  }

  return { limit, dryRun };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build the input object that formatContentVersion expects. */
function buildInput(
  cv: ContentVersion,
  parentItem?: Item | null,
): FormatContentVersionInput {
  const lang: ContentLanguage = cv.language === "ht" ? "ht" : "fr";

  // Determine series: utilityMeta.series on parent, or "News" / "Synthesis"
  let series: string | undefined;
  if (parentItem?.itemType === "utility" && parentItem.utilityMeta?.series) {
    series = parentItem.utilityMeta.series;
  } else if (parentItem?.itemType === "synthesis") {
    series = "News"; // synthesis articles use news tone
  } else {
    series = "News";
  }

  return {
    lang,
    title: cv.title,
    summary: cv.summary ?? undefined,
    sections: cv.sections ?? undefined,
    body: cv.body ?? undefined,
    sourceCitations: cv.sourceCitations ?? undefined,
    series,
  };
}

/** Shallow-compare two values (handles arrays of objects). */
function fieldsChanged(
  original: Record<string, unknown>,
  formatted: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(formatted)) {
    const a = original[key];
    const b = formatted[key];
    if (a === b) continue;
    if (a === undefined && b === undefined) continue;
    // Compare via JSON for objects/arrays
    if (JSON.stringify(a) !== JSON.stringify(b)) return true;
  }
  return false;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const { limit, dryRun } = parseArgs();

  console.log(
    `\n🔄 Backfill format content_versions — ${dryRun ? "DRY RUN" : "LIVE MODE"} (limit=${limit})\n`,
  );

  const db = getDb();
  const col = db.collection("content_versions");

  const BATCH_SIZE = 100;
  let totalScanned = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let hasMore = true;

  // Cache items to avoid repeated lookups within a run
  const itemCache = new Map<string, Item | null>();

  async function getItem(itemId: string): Promise<Item | null> {
    if (itemCache.has(itemId)) return itemCache.get(itemId)!;
    try {
      const item = await itemsRepo.getItem(itemId);
      itemCache.set(itemId, item);
      return item;
    } catch {
      itemCache.set(itemId, null);
      return null;
    }
  }

  while (hasMore && totalScanned < limit) {
    const remaining = limit - totalScanned;
    const pageSize = Math.min(BATCH_SIZE, remaining);

    let query = col.orderBy("createdAt", "desc").limit(pageSize);
    if (lastDocSnap) {
      query = query.startAfter(lastDocSnap);
    }

    const snap = await query.get();

    if (snap.empty) {
      hasMore = false;
      break;
    }

    lastDocSnap = snap.docs[snap.docs.length - 1];

    // Process documents
    const writeBatch = dryRun ? null : db.batch();
    let batchWrites = 0;

    for (const doc of snap.docs) {
      totalScanned++;
      try {
        const cv = { id: doc.id, ...doc.data() } as ContentVersion;
        const parentItem = await getItem(cv.itemId);

        const input = buildInput(cv, parentItem);
        const output = formatContentVersion(input);

        // Build comparison objects from stored vs formatted
        const stored: Record<string, unknown> = {
          title: cv.title,
          summary: cv.summary,
          sections: cv.sections,
          body: cv.body,
          sourceCitations: cv.sourceCitations,
        };
        const formatted: Record<string, unknown> = {
          title: output.title,
          summary: output.summary,
          sections: output.sections,
          body: output.body,
          sourceCitations: output.sourceCitations,
        };

        if (!fieldsChanged(stored, formatted)) continue;

        totalUpdated++;

        if (dryRun) {
          console.log(`  📝 [diff] ${doc.id} (${cv.language}) — "${cv.title?.slice(0, 60)}…"`);
        } else {
          // Build update payload (only changed fields)
          const update: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (output.title !== cv.title) update.title = output.title;
          if (JSON.stringify(output.summary) !== JSON.stringify(cv.summary))
            update.summary = output.summary;
          if (JSON.stringify(output.sections) !== JSON.stringify(cv.sections))
            update.sections = output.sections;
          if (JSON.stringify(output.body) !== JSON.stringify(cv.body))
            update.body = output.body;
          if (JSON.stringify(output.sourceCitations) !== JSON.stringify(cv.sourceCitations))
            update.sourceCitations = output.sourceCitations;

          writeBatch!.update(doc.ref, update);
          batchWrites++;

          // Firestore batches limited to 500 writes
          if (batchWrites >= 400) {
            await writeBatch!.commit();
            batchWrites = 0;
          }
        }
      } catch (err) {
        totalErrors++;
        console.error(`  ❌ Error processing ${doc.id}:`, err);
      }
    }

    // Commit remaining writes
    if (!dryRun && batchWrites > 0) {
      await writeBatch!.commit();
    }

    console.log(`  … scanned ${totalScanned}/${limit}`);
  }

  console.log(`\n✅ Done!`);
  console.log(`   Total scanned:  ${totalScanned}`);
  console.log(`   Total updated:  ${totalUpdated}`);
  console.log(`   Total errors:   ${totalErrors}`);
  if (dryRun) console.log(`   (dry run — no writes performed)`);
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
