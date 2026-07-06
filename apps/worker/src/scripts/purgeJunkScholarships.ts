/**
 * One-off purge of low-quality auto-discovered scholarships from /bourses.
 *
 * Deletes a scholarship if ANY of these hold (and it is NOT a curated-seed
 * entry, which is always protected by name):
 *   1. Explicitly not open to Haitians   (haitianEligibility === "no")
 *   2. Expired                            (a concrete deadline/keyDate strictly
 *                                          before today; month-only / "varies"
 *                                          / undated are NOT treated as expired)
 *   3. Aggregator official link           (officialUrl points at a content
 *                                          aggregator, not a real program site)
 *   4. Aggregator-only sourcing           (every source URL is an aggregator /
 *                                          Google-News link — scraped, no real
 *                                          citation)
 *
 * Curated flagship scholarships (from the seed JSON files) are never deleted.
 * Re-running the flagship seed after this restores/updates the good set.
 *
 * Usage:
 *   DRY_RUN=true  npx tsx src/scripts/purgeJunkScholarships.ts   # report only
 *   npx tsx src/scripts/purgeJunkScholarships.ts                 # delete
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { getDb } from "@edlight-news/firebase";
import type { Scholarship } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });

const DRY_RUN = process.env.DRY_RUN === "true";

const AGGREGATOR_HOSTS = [
  "news.google.com", "opportunitydesk.org", "afterschoolafrica.com",
  "scholars4dev.com", "scholarshippositions.com", "opportunitiesforafricans.com",
  "oyaop.com", "youthop.com", "scholarshiproar.com", "opportunitycorners.info",
];

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function isAggregatorHost(url: string | undefined): boolean {
  const host = hostOf(url);
  return !!host && AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

/** Load protected (curated-seed) scholarship names, normalised. */
function loadSeedNames(): Set<string> {
  const names = new Set<string>();
  const files = [
    "../data/scholarships_seed_ca_fr_uk.json",
    "../data/scholarships_seed_flagship.json",
  ];
  for (const rel of files) {
    const p = path.resolve(__dirname, rel);
    if (!fs.existsSync(p)) continue;
    try {
      const arr = JSON.parse(fs.readFileSync(p, "utf-8")) as { name?: string }[];
      for (const s of arr) if (s.name) names.add(s.name.trim().toLowerCase());
    } catch (err) {
      console.warn(`[purge] could not parse ${rel}:`, err);
    }
  }
  return names;
}

function earliestConcreteDate(s: Scholarship): string | null {
  const dates: string[] = [];
  if (s.deadline?.dateISO) dates.push(s.deadline.dateISO);
  for (const kd of s.keyDates ?? []) if (kd.dateISO) dates.push(kd.dateISO);
  if (dates.length === 0) return null;
  return dates.sort()[dates.length - 1]!; // latest concrete date (most lenient)
}

/**
 * Flagship-imposter programmes verified (via official pages) to EXCLUDE
 * Haitians or to be discontinued — remove them even though they aren't
 * expired/aggregator, since they can't be acted on by our audience.
 */
const INELIGIBLE_NAME_PATTERNS = [
  "commonwealth", "rhodes", "australia award", "aga khan",
  "mastercard foundation", "swedish institute", "vanier",
];

function junkReason(s: Scholarship, todayISO: string): string | null {
  if (s.haitianEligibility === "no") return "not-haiti-eligible";
  const nameLc = (s.name ?? "").toLowerCase();
  if (INELIGIBLE_NAME_PATTERNS.some((p) => nameLc.includes(p))) {
    return "ineligible-or-discontinued-programme";
  }
  const latest = earliestConcreteDate(s);
  if (latest && latest < todayISO) return `expired(${latest})`;
  if (isAggregatorHost(s.officialUrl)) return "aggregator-official-url";
  const srcUrls = (s.sources ?? []).map((c) => c.url);
  if (srcUrls.length > 0 && srcUrls.every((u) => isAggregatorHost(u))) {
    return "aggregator-only-sources";
  }
  return null;
}

async function main() {
  console.log(`=== purgeJunkScholarships ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  const db = getDb();
  const seedNames = loadSeedNames();
  console.log(`Protected curated-seed names: ${seedNames.size}`);

  const snap = await db.collection("scholarships").get();
  console.log(`scholarships collection holds ${snap.size} docs.`);

  const todayISO = new Date().toISOString().slice(0, 10);
  const reasons = new Map<string, number>();
  const toDelete: { id: string; name: string; reason: string }[] = [];
  let protectedCount = 0;

  for (const doc of snap.docs) {
    const s = { id: doc.id, ...doc.data() } as Scholarship;
    if (s.name && seedNames.has(s.name.trim().toLowerCase())) {
      protectedCount++;
      continue;
    }
    const reason = junkReason(s, todayISO);
    if (reason) {
      toDelete.push({ id: doc.id, name: s.name ?? "(unnamed)", reason });
      const key = reason.split("(")[0]!;
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
  }

  console.log(`\nProtected (curated seed): ${protectedCount}`);
  console.log(`Flagged for deletion: ${toDelete.length}`);
  for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }
  console.log("\nSample:");
  for (const d of toDelete.slice(0, 15)) {
    console.log(`  - [${d.reason}] ${d.name}`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] nothing deleted.");
    process.exit(0);
  }

  let deleted = 0;
  let batch = db.batch();
  let ops = 0;
  for (const d of toDelete) {
    batch.delete(db.collection("scholarships").doc(d.id));
    ops++;
    deleted++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  console.log(`\nDeleted ${deleted} junk scholarships. ${protectedCount} curated kept.`);
  console.log("=== done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
