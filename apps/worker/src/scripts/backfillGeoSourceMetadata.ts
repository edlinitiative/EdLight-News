#!/usr/bin/env npx tsx
/**
 * Backfill existing item geo/source metadata after tightening Google News and
 * Diaspora classification rules.
 *
 * What it fixes:
 *   - Recomputes geoTag/audienceFitScore with current scoring rules so normal
 *     Haiti articles move from Diaspora → HT when diaspora context is absent.
 *   - Repairs Google News items that have raw_items.publisherUrl by replacing
 *     aggregator links with the real publisher URL in canonicalUrl, source, and
 *     citations.
 *   - Strips Google News publisher suffixes from item titles when safe.
 *   - Mirrors repaired citations into content_versions for the same item.
 *
 * Usage:
 *   pnpm backfill:geo-sources                         # dry run, no writes
 *   pnpm backfill:geo-sources -- --confirm            # live writes
 *   pnpm backfill:geo-sources -- --limit=100          # dry run first 100
 *   pnpm backfill:geo-sources -- --confirm --limit=100
 *
 * Safe to re-run. The script writes a geoSourceBackfillAt timestamp in live mode.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, rawItemsRepo } from "@edlight-news/firebase";
import type { Citation, GeoTag, Item, ItemSource, RawItem } from "@edlight-news/types";
import { parseGoogleNewsTitle } from "@edlight-news/scraper";
import { classifyItem } from "../services/classify.js";
import { buildItemSource, computeScoring, isAggregatorUrl } from "../services/scoring.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const CONFIRM = process.argv.includes("--confirm");
const DRY_RUN = !CONFIRM;
const BATCH_SIZE = 200;

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : Infinity;

function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).toString();
  } catch {
    return undefined;
  }
}

function isAggregatorSource(item: Item): boolean {
  const urls = [
    item.canonicalUrl,
    item.source?.originalUrl,
    item.source?.aggregatorUrl,
    ...(item.citations ?? []).map((citation) => citation.sourceUrl),
  ].filter(Boolean) as string[];

  return urls.some((url) => isAggregatorUrl(url));
}

function chooseSourceName(item: Item, raw: RawItem | null): string {
  const parsedRaw = raw?.title ? parseGoogleNewsTitle(raw.title) : undefined;
  const parsedItem = parseGoogleNewsTitle(item.title ?? "");

  return (
    parsedRaw?.publisherName ||
    parsedItem.publisherName ||
    item.source?.name ||
    item.citations?.[0]?.sourceName ||
    "Unknown"
  );
}

function maybeCleanTitle(title: string): string | undefined {
  const { cleanTitle, publisherName } = parseGoogleNewsTitle(title);
  if (!publisherName) return undefined;
  if (cleanTitle === title || cleanTitle.length < 5) return undefined;
  return cleanTitle;
}

function updatePrimaryCitation(citations: Citation[] | undefined, sourceName: string, sourceUrl: string): Citation[] {
  const existing = citations ?? [];
  if (existing.length === 0) return [{ sourceName, sourceUrl }];
  return [
    { ...existing[0], sourceName, sourceUrl },
    ...existing.slice(1),
  ];
}

function sameSource(a: ItemSource | undefined, b: ItemSource): boolean {
  return (
    a?.name === b.name &&
    a?.originalUrl === b.originalUrl &&
    a?.aggregatorUrl === b.aggregatorUrl
  );
}

function sameCitations(a: Citation[] | undefined, b: Citation[]): boolean {
  const left = a ?? [];
  if (left.length !== b.length) return false;
  return left.every((citation, index) =>
    citation.sourceName === b[index]?.sourceName &&
    citation.sourceUrl === b[index]?.sourceUrl
  );
}

async function getRawItem(rawItemId: string | undefined, cache: Map<string, RawItem | null>): Promise<RawItem | null> {
  if (!rawItemId) return null;
  if (cache.has(rawItemId)) return cache.get(rawItemId) ?? null;
  const raw = await rawItemsRepo.getRawItem(rawItemId);
  cache.set(rawItemId, raw);
  return raw;
}

function shouldSkipItem(item: Item): boolean {
  // Utility/synthesis/opinion items are authored/assembled content with their
  // own geo/source semantics. This backfill targets source-ingested articles.
  return item.itemType === "utility" || item.itemType === "synthesis" || item.itemType === "opinion";
}

async function main() {
  if (!Number.isFinite(LIMIT) && LIMIT !== Infinity) {
    throw new Error(`Invalid --limit value: ${limitArg}`);
  }

  console.log(
    `\n🧭 Backfill geo/source metadata — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}` +
    (LIMIT < Infinity ? ` — limit=${LIMIT}` : "") +
    "\n",
  );

  const db = getDb();
  const itemsCol = db.collection("items");
  const cvsCol = db.collection("content_versions");
  const rawCache = new Map<string, RawItem | null>();

  let scanned = 0;
  let considered = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (scanned < LIMIT) {
    let query = itemsCol
      .orderBy("createdAt", "desc")
      .limit(Math.min(BATCH_SIZE, LIMIT - scanned));

    if (lastDocSnap) query = query.startAfter(lastDocSnap);

    const snap = await query.get();
    if (snap.empty) break;

    lastDocSnap = snap.docs[snap.docs.length - 1];
    const writer = DRY_RUN ? null : db.bulkWriter();
    writer?.onWriteError((error) => {
      console.error(`  ❌ Write error for ${error.documentRef.path}: ${error.message}`);
      return false;
    });

    for (const doc of snap.docs) {
      if (scanned >= LIMIT) break;
      scanned++;

      const item = { id: doc.id, ...doc.data() } as Item;
      if (shouldSkipItem(item)) {
        skipped++;
        continue;
      }

      considered++;

      try {
        const raw = await getRawItem(item.rawItemId, rawCache);
        const textForScoring = `${item.title} ${item.extractedText || item.summary || ""}`;
        const scoring = computeScoring(item.title, textForScoring, item.category);
        const classification = classifyItem(item.title, item.summary ?? "", item.extractedText ?? "");
        const newGeoTag: GeoTag = classification.isOpportunity
          ? (classification.geoTag ?? scoring.geoTag)
          : scoring.geoTag;

        const publisherUrl = safeUrl(raw?.publisherUrl);
        const aggregatorItem = isAggregatorSource(item);
        const sourceName = chooseSourceName(item, raw);
        const currentBestUrl = item.source?.originalUrl || item.citations?.[0]?.sourceUrl || item.canonicalUrl;
        const targetSourceUrl = publisherUrl || currentBestUrl;
        const { source: targetSource, weakSource } = buildItemSource(sourceName, targetSourceUrl);
        const cleanTitle = maybeCleanTitle(item.title);
        const targetCitations = updatePrimaryCitation(item.citations, sourceName, targetSource.originalUrl);

        const update: Record<string, unknown> = {};
        const reasons: string[] = [];

        const shouldRefreshScoringFields = item.geoTag !== newGeoTag;

        if (item.geoTag !== newGeoTag) {
          update.geoTag = newGeoTag;
          reasons.push(`geo ${item.geoTag ?? "∅"}→${newGeoTag}`);
        }
        if (shouldRefreshScoringFields && item.audienceFitScore !== scoring.audienceFitScore) {
          update.audienceFitScore = scoring.audienceFitScore;
        }
        if (shouldRefreshScoringFields && item.qualityFlags?.offMission !== scoring.offMission) {
          update["qualityFlags.offMission"] = scoring.offMission;
        }
        if (item.qualityFlags?.weakSource !== weakSource) {
          update["qualityFlags.weakSource"] = weakSource;
        }
        if (publisherUrl && item.canonicalUrl !== publisherUrl) {
          update.canonicalUrl = publisherUrl;
          reasons.push("canonical Google News→publisher");
        }
        if (!sameSource(item.source, targetSource)) {
          update.source = targetSource;
          if (publisherUrl || aggregatorItem) reasons.push("source repaired");
        }
        if (!sameCitations(item.citations, targetCitations)) {
          update.citations = targetCitations;
          if (publisherUrl || aggregatorItem) reasons.push("citations repaired");
        }
        if (cleanTitle) {
          update.title = cleanTitle;
          reasons.push("title cleaned");
        }

        if (Object.keys(update).length === 0) {
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(
            `  🔍 [DRY] ${item.id} "${item.title.slice(0, 70)}…"` +
            `\n      ${reasons.join(", ") || "metadata refresh"}`,
          );
        } else if (writer) {
          writer.update(doc.ref, {
            ...update,
            geoSourceBackfillAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          if (update.citations) {
            const cvSnap = await cvsCol.where("itemId", "==", item.id).get();
            for (const cvDoc of cvSnap.docs) {
              const cv = cvDoc.data();
              const nextCvCitations = updatePrimaryCitation(cv.citations, sourceName, targetSource.originalUrl);
              writer.update(cvDoc.ref, {
                citations: nextCvCitations,
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          }
        }

        updated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠️  Error processing ${item.id}: ${msg}`);
        errors++;
      }
    }

    if (writer) await writer.close();

    console.log(
      `  📦 Page: ${snap.docs.length} scanned, ${updated} updates queued so far, ${skipped} skipped`,
    );

    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log("\n✅ Geo/source backfill complete");
  console.log(`   Scanned:     ${scanned}`);
  console.log(`   Considered:  ${considered}`);
  console.log(`   Updated:     ${updated}`);
  console.log(`   Skipped:     ${skipped}`);
  console.log(`   Errors:      ${errors}`);
  console.log(`   Mode:        ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
