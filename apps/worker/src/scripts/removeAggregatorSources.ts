/**
 * One-off cleanup: delete RFI, Google News, and other news-aggregator
 * source documents from the `sources` Firestore collection.
 *
 * The seeder (docs/sources.seed.json) only upserts — it never deletes.
 * Run this script after removing the entries from the seed JSON to
 * actually purge them from Firestore so the ingest worker stops polling.
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

function hostOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return "";
  }
}

function isAggregator(url: string): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return AGGREGATOR_HOSTS.some((agg) => h === agg || h.endsWith(`.${agg}`));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const db = getDb();
  const snap = await db.collection("sources").get();

  const targets: { id: string; name: string; url: string }[] = [];
  for (const d of snap.docs) {
    const data = d.data() as { name?: string; url?: string };
    const url = data.url ?? "";
    if (isAggregator(url)) {
      targets.push({ id: d.id, name: data.name ?? "(unknown)", url });
    }
  }

  console.log(
    `Found ${targets.length} aggregator source(s) of ${snap.size} total:`,
  );
  for (const t of targets) console.log(`  - ${t.name}  ${t.url}`);

  if (dryRun) {
    console.log("\nDry-run — no deletions performed.");
    return;
  }

  let deleted = 0;
  for (const t of targets) {
    await db.collection("sources").doc(t.id).delete();
    deleted++;
  }
  console.log(`\n✅ Deleted ${deleted} source document(s).`);
}

main().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
