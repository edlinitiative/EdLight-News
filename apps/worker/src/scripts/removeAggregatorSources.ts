/**
 * One-off cleanup: purge every trace of news-aggregator content from
 * Firestore (RFI, Google News, Yahoo News, MSN, Flipboard, SmartNews, …).
 *
 * The seeder (docs/sources.seed.json) only upserts — it never deletes — and
 * removing a source from the seed file does NOT remove articles that were
 * already ingested + published from that source. This script wipes them
 * across four collections so the live website + ingest pipeline stop
 * referencing aggregator content entirely:
 *
 *   1. sources           — by url hostname
 *   2. raw_items         — by url hostname (also catches `publisherUrl`)
 *                          OR by sourceId pointing at a deleted aggregator
 *   3. items             — by canonicalUrl hostname OR sourceId match
 *                          OR (synthesis) when every citation is aggregator
 *   4. content_versions  — by itemId pointing at a deleted item
 *                          (these are the /news/[id] pages on the website)
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker exec tsx \
 *     src/scripts/removeAggregatorSources.ts [--dry-run]
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

// ── Load .env from monorepo root ───────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

/** Hostnames considered news aggregators — keep in sync with scoring.ts. */
const AGGREGATOR_HOSTS = [
  "news.google.com",
  "news.yahoo.com",
  "msn.com",
  "flipboard.com",
  "smartnews.com",
  "rfi.fr",
] as const;

function hostOf(url: string | undefined | null): string {
  if (!url) return "";
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return "";
  }
}

function isAggregator(url: string | undefined | null): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return AGGREGATOR_HOSTS.some((agg) => h === agg || h.endsWith(`.${agg}`));
}

/** Delete an array of doc refs in chunks of 400 (Firestore batch limit 500). */
async function batchDelete(
  refs: FirebaseFirestore.DocumentReference[],
  label: string,
  dryRun: boolean,
): Promise<number> {
  if (refs.length === 0) {
    console.log(`  ${label}: nothing to delete.`);
    return 0;
  }
  if (dryRun) {
    console.log(`  ${label}: would delete ${refs.length} doc(s) (dry-run).`);
    return 0;
  }
  const db = getDb();
  let deleted = 0;
  for (let i = 0; i < refs.length; i += 400) {
    const slice = refs.slice(i, i + 400);
    const batch = db.batch();
    for (const ref of slice) batch.delete(ref);
    await batch.commit();
    deleted += slice.length;
  }
  console.log(`  ${label}: deleted ${deleted} doc(s).`);
  return deleted;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `\n🧹 Aggregator cleanup — ${dryRun ? "DRY RUN" : "LIVE"} (hosts: ${AGGREGATOR_HOSTS.join(", ")})\n`,
  );

  const db = getDb();

  // ── 1. sources ─────────────────────────────────────────────────────────
  console.log("sources:");
  const sourcesSnap = await db.collection("sources").get();
  const aggregatorSourceIds = new Set<string>();
  const sourceRefs: FirebaseFirestore.DocumentReference[] = [];
  for (const d of sourcesSnap.docs) {
    const data = d.data() as { url?: string; name?: string };
    if (isAggregator(data.url)) {
      aggregatorSourceIds.add(d.id);
      sourceRefs.push(d.ref);
      console.log(`    • ${data.name ?? "(unknown)"}  ${data.url}`);
    }
  }
  await batchDelete(sourceRefs, "sources", dryRun);

  // ── 2. raw_items ───────────────────────────────────────────────────────
  console.log("\nraw_items:");
  const rawSnap = await db.collection("raw_items").get();
  const rawRefs: FirebaseFirestore.DocumentReference[] = [];
  for (const d of rawSnap.docs) {
    const data = d.data() as {
      url?: string;
      publisherUrl?: string | null;
      sourceId?: string;
    };
    if (
      isAggregator(data.url) ||
      isAggregator(data.publisherUrl) ||
      (data.sourceId && aggregatorSourceIds.has(data.sourceId))
    ) {
      rawRefs.push(d.ref);
    }
  }
  await batchDelete(rawRefs, "raw_items", dryRun);

  // ── 3. items ───────────────────────────────────────────────────────────
  console.log("\nitems:");
  const itemsSnap = await db.collection("items").get();
  const itemRefs: FirebaseFirestore.DocumentReference[] = [];
  const aggregatorItemIds = new Set<string>();
  for (const d of itemsSnap.docs) {
    const data = d.data() as {
      canonicalUrl?: string;
      sourceId?: string;
      sourceList?: Array<{ url?: string }>;
      citations?: Array<{ url?: string }>;
    };
    const canonHit = isAggregator(data.canonicalUrl);
    const sourceHit = data.sourceId
      ? aggregatorSourceIds.has(data.sourceId)
      : false;
    // Synthesis items aggregate multiple citations — only purge if EVERY
    // contributing URL is an aggregator. Otherwise we'd nuke legitimate
    // coverage that merely cited an aggregator alongside first-party feeds.
    const refs = [
      ...(data.sourceList ?? []),
      ...(data.citations ?? []),
    ].filter((r) => typeof r?.url === "string");
    const allRefsAggregator =
      refs.length > 0 && refs.every((r) => isAggregator(r.url));

    if (canonHit || sourceHit || allRefsAggregator) {
      itemRefs.push(d.ref);
      aggregatorItemIds.add(d.id);
    }
  }
  await batchDelete(itemRefs, "items", dryRun);

  // ── 4. content_versions ────────────────────────────────────────────────
  // These are the rendered article docs the website reads from
  // /news/[id]. Deleting the upstream item is not enough; we must also
  // delete the published versions or stale pages will keep loading
  // (until they 404 because the item lookup fails).
  console.log("\ncontent_versions:");
  const cvSnap = await db.collection("content_versions").get();
  const cvRefs: FirebaseFirestore.DocumentReference[] = [];
  for (const d of cvSnap.docs) {
    const data = d.data() as { itemId?: string };
    if (data.itemId && aggregatorItemIds.has(data.itemId)) {
      cvRefs.push(d.ref);
    }
  }
  await batchDelete(cvRefs, "content_versions", dryRun);

  console.log(
    `\n${dryRun ? "Dry-run complete — re-run without --dry-run to apply." : "✅ Cleanup complete."}\n`,
  );
}

main().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
