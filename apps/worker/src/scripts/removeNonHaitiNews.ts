/**
 * One-off cleanup: purge news-style items from Firestore that have no
 * connection to Haiti, Haitian diaspora, or Haitian students.
 *
 * Why:
 *   The ingest pipeline pulls from broad feeds (BBC Latin America, France 24
 *   Amériques, Al Jazeera World, UN News, etc.) and assigns geoTag="HT" only
 *   when Haiti-specific markers appear in the title/summary. Everything else
 *   gets geoTag="Global", and a lot of that is genuinely off-mission (e.g.,
 *   Venezuela politics, Mexico cartels, generic UN press releases). This
 *   script deletes those items + their published web content_versions.
 *
 * Conservative rules — we ONLY purge an item when ALL of these are true:
 *   1. itemType is undefined / "source" / "synthesis" (i.e., editorial news;
 *      we never touch "utility" or "opinion" items)
 *   2. category is news-y: news / local_news / event
 *      (scholarships / opportunities / bourses / concours / stages /
 *      programmes are NEVER purged — those are globally-eligible by design)
 *   3. geoTag is "Global" (NOT "HT" and NOT "Diaspora")
 *   4. vertical is not "haiti"
 *   5. Title + summary contain ZERO Haiti markers
 *      (haiti, haïti, ayiti, port-au-prince, kreyòl, MENFP, BRH, …)
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker exec tsx \
 *     src/scripts/removeNonHaitiNews.ts [--dry-run]
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

// ── Load .env from monorepo root ───────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// Keep in sync with apps/worker/src/services/scoring.ts
const HAITI_MARKERS = [
  "haiti", "haïti", "haitian", "haïtien", "haitienne", "haïtienne",
  "haitians", "haïtiens", "haïtiennes", "haitiens", "haitiennes",
  "ayiti", "ayisyen", "ayisyèn", "kreyòl", "kreyol", "creole",
  "port-au-prince", "port au prince", "pap",
  "cap-haïtien", "cap-haitien", "cap haïtien",
  "les cayes", "gonaïves", "gonaives", "jacmel", "jérémie", "jeremie",
  "hinche", "mirebalais", "pétion-ville", "petionville", "petion-ville",
  "delmas", "carrefour", "cité soleil", "cite soleil",
  "menfp", "brh", "bnrh", "uniq", "ueh",
  "phtk", "fanmi lavalas", "moïse", "ariel henry",
  "little haiti", "haitian american", "haitian-american",
  "haitian canadian", "haitian-canadian", "diaspora haïtien",
  "diaspora haitien", "diaspora haïtienne",
];

const NEWS_CATEGORIES = new Set(["news", "local_news", "event"]);

function hasHaitiMarker(text: string): boolean {
  const t = text.toLowerCase();
  return HAITI_MARKERS.some((m) => t.includes(m));
}

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

interface ItemDoc {
  itemType?: string;
  category?: string;
  geoTag?: string;
  vertical?: string;
  title?: string;
  summary?: string;
  extractedText?: string | null;
}

function isOffMission(d: ItemDoc): boolean {
  const itemType = d.itemType ?? "source";
  if (itemType !== "source" && itemType !== "synthesis") return false;

  const cat = d.category ?? "";
  if (!NEWS_CATEGORIES.has(cat)) return false;

  if (d.geoTag === "HT" || d.geoTag === "Diaspora") return false;
  if (d.geoTag !== "Global") return false; // unknown/missing → leave alone

  if (d.vertical === "haiti") return false;

  const text = `${d.title ?? ""}\n${d.summary ?? ""}\n${d.extractedText ?? ""}`;
  if (hasHaitiMarker(text)) return false;

  return true;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const showSample = process.argv.includes("--sample");
  console.log(
    `\n🧹 Non-Haiti news cleanup — ${dryRun ? "DRY RUN" : "LIVE"}\n`,
  );

  const db = getDb();

  // ── 1. Walk items, identify off-mission docs ────────────────────────────
  console.log("items:");
  const itemsSnap = await db.collection("items").get();
  const itemRefs: FirebaseFirestore.DocumentReference[] = [];
  const offMissionItemIds = new Set<string>();
  const samples: { title: string; summary: string; sourceId?: string }[] = [];

  for (const d of itemsSnap.docs) {
    const data = d.data() as ItemDoc & { sourceId?: string };
    if (isOffMission(data)) {
      itemRefs.push(d.ref);
      offMissionItemIds.add(d.id);
      if (samples.length < 10) {
        samples.push({
          title: (data.title ?? "").slice(0, 90),
          summary: (data.summary ?? "").slice(0, 120),
          sourceId: data.sourceId,
        });
      }
    }
  }
  console.log(
    `  scanned ${itemsSnap.size} items, flagged ${itemRefs.length} as off-mission.`,
  );
  if (showSample || dryRun) {
    console.log("\n  sample (up to 10):");
    for (const s of samples) {
      console.log(`    • ${s.title}`);
      console.log(`      ${s.summary}`);
    }
    console.log("");
  }
  await batchDelete(itemRefs, "items", dryRun);

  // ── 2. content_versions tied to deleted items ───────────────────────────
  console.log("\ncontent_versions:");
  const cvSnap = await db.collection("content_versions").get();
  const cvRefs: FirebaseFirestore.DocumentReference[] = [];
  for (const d of cvSnap.docs) {
    const data = d.data() as { itemId?: string };
    if (data.itemId && offMissionItemIds.has(data.itemId)) {
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
