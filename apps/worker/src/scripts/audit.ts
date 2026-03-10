/**
 * Comprehensive audit of EdLight News content quality — Website & Instagram.
 *
 * Queries Firestore directly for:
 * - Website content_versions: volume, language coverage, status distribution,
 *   quality flags, category balance, source diversity, publishing cadence, gaps
 * - Instagram ig_queue + ig_story_queue: volume, status funnel, post frequency,
 *   type diversity, render/publish success, content freshness
 *
 * Usage: npx tsx src/scripts/audit.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { Timestamp } from "firebase-admin/firestore";

const db = getDb();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function ago(days: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() - days * 86_400_000));
}
function fmtDate(ts: any): string {
  if (!ts) return "N/A";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 16).replace("T", " ");
}
function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}
function counter<T extends string>(arr: T[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const v of arr) m[v] = (m[v] ?? 0) + 1;
  return m;
}
const BAR = "─".repeat(60);

/* ------------------------------------------------------------------ */
/*  1. WEBSITE AUDIT — content_versions                               */
/* ------------------------------------------------------------------ */

async function auditWebsite() {
  console.log("\n" + "═".repeat(60));
  console.log("  WEBSITE CONTENT AUDIT");
  console.log("═".repeat(60));

  // --- 1a. Total counts & status distribution ---
  const allCV = await db.collection("content_versions").get();
  const docs = allCV.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  console.log(`\nTotal content_versions: ${docs.length}`);

  const statuses = counter(docs.map((d) => d.status ?? "unknown"));
  console.log("\n📊 Status distribution:");
  for (const [s, n] of Object.entries(statuses).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(20)} ${String(n).padStart(5)}  (${pct(n, docs.length)})`);
  }

  // --- 1b. Language coverage ---
  const langs = counter(docs.map((d) => d.language ?? "unknown"));
  console.log("\n🌐 Language coverage:");
  for (const [l, n] of Object.entries(langs).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${l.padEnd(20)} ${String(n).padStart(5)}  (${pct(n, docs.length)})`);
  }

  // Check bilingual pairing (same itemId should have fr + ht)
  const byItem = new Map<string, string[]>();
  for (const d of docs) {
    if (d.itemId) {
      if (!byItem.has(d.itemId)) byItem.set(d.itemId, []);
      byItem.get(d.itemId)!.push(d.language);
    }
  }
  const paired = [...byItem.values()].filter((l) => l.includes("fr") && l.includes("ht")).length;
  const frOnly = [...byItem.values()].filter((l) => l.includes("fr") && !l.includes("ht")).length;
  const htOnly = [...byItem.values()].filter((l) => !l.includes("fr") && l.includes("ht")).length;
  console.log(`\n  Bilingual pairs (FR+HT): ${paired}`);
  console.log(`  FR only (missing HT):   ${frOnly}`);
  console.log(`  HT only (missing FR):   ${htOnly}`);

  // --- 1c. Channel distribution ---
  const channels = counter(docs.map((d) => d.channel ?? "unknown"));
  console.log("\n📺 Channel distribution:");
  for (const [c, n] of Object.entries(channels).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(20)} ${String(n).padStart(5)}  (${pct(n, docs.length)})`);
  }

  // --- 1d. Published articles — deeper analysis ---
  const published = docs.filter((d) => d.status === "published");
  console.log(`\n${BAR}`);
  console.log(`Published articles: ${published.length}`);

  // Category distribution (from items)
  const allItems = await db.collection("items").get();
  const items = new Map(allItems.docs.map((d) => [d.id, d.data()]));

  const pubItemIds = [...new Set(published.map((d) => d.itemId).filter(Boolean))];
  const pubItems = pubItemIds.map((id) => items.get(id)).filter(Boolean) as any[];

  const categories = counter(pubItems.map((i) => i.category ?? "uncategorized"));
  console.log("\n📂 Category distribution (published items):");
  for (const [c, n] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(25)} ${String(n).padStart(5)}  (${pct(n, pubItems.length)})`);
  }

  // Item types
  const itemTypes = counter(pubItems.map((i) => i.itemType ?? "unknown"));
  console.log("\n📋 Item type distribution (published):");
  for (const [t, n] of Object.entries(itemTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(25)} ${String(n).padStart(5)}  (${pct(n, pubItems.length)})`);
  }

  // Audience fit score distribution
  const scores = pubItems.map((i) => i.audienceFitScore ?? 0).filter((s: number) => s > 0);
  if (scores.length > 0) {
    const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    const low = scores.filter((s: number) => s < 0.5).length;
    const mid = scores.filter((s: number) => s >= 0.5 && s < 0.75).length;
    const high = scores.filter((s: number) => s >= 0.75).length;
    console.log(`\n🎯 Audience fit scores (published items with scores):`);
    console.log(`  Average:  ${avg.toFixed(2)}`);
    console.log(`  Low (<0.5):    ${low}  (${pct(low, scores.length)})`);
    console.log(`  Mid (0.5–0.75): ${mid}  (${pct(mid, scores.length)})`);
    console.log(`  High (≥0.75):  ${high}  (${pct(high, scores.length)})`);
  }

  // GeoTag distribution
  const geoTags = counter(pubItems.map((i) => i.geoTag ?? "untagged"));
  console.log("\n🌍 Geographic distribution (published items):");
  for (const [g, n] of Object.entries(geoTags).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${g.padEnd(25)} ${String(n).padStart(5)}  (${pct(n, pubItems.length)})`);
  }

  // --- 1e. Quality flags ---
  const qualityFlags = published.filter((d) => d.qualityFlags && Object.keys(d.qualityFlags).length > 0);
  if (qualityFlags.length > 0) {
    const allFlags: Record<string, number> = {};
    for (const d of qualityFlags) {
      for (const [k, v] of Object.entries(d.qualityFlags)) {
        if (v === true || v === "fail") allFlags[k] = (allFlags[k] ?? 0) + 1;
      }
    }
    console.log("\n⚠️  Quality flags on published content:");
    for (const [f, n] of Object.entries(allFlags).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${f.padEnd(30)} ${String(n).padStart(5)}  (${pct(n, published.length)})`);
    }
  }

  // --- 1f. Publishing cadence (last 14 days) ---
  console.log(`\n${BAR}`);
  console.log("📅 Publishing cadence (last 14 days):");
  const now = new Date();
  for (let d = 0; d < 14; d++) {
    const day = new Date(now.getTime() - d * 86_400_000);
    const dayStr = day.toISOString().slice(0, 10);
    const count = published.filter((doc) => {
      const created = doc.createdAt?.toDate?.() ?? new Date(0);
      return created.toISOString().slice(0, 10) === dayStr;
    }).length;
    const bar = "█".repeat(Math.min(count, 50));
    console.log(`  ${dayStr}  ${String(count).padStart(4)}  ${bar}`);
  }

  // --- 1g. Source diversity ---
  const sources = await db.collection("sources").where("enabled", "==", true).get();
  const sourceMap = new Map(sources.docs.map((d) => [d.id, d.data()]));
  const sourceCounts: Record<string, number> = {};
  for (const item of pubItems) {
    const srcId = item.sourceId ?? "unknown";
    const srcName = sourceMap.get(srcId)?.name ?? srcId;
    sourceCounts[srcName] = (sourceCounts[srcName] ?? 0) + 1;
  }
  const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\n📰 Top 15 sources (published items):`);
  for (const [name, n] of sortedSources.slice(0, 15)) {
    console.log(`  ${name.slice(0, 35).padEnd(35)} ${String(n).padStart(5)}  (${pct(n, pubItems.length)})`);
  }
  console.log(`  Total distinct sources: ${sortedSources.length}`);

  // --- 1h. Image coverage ---
  const withImage = published.filter((d) => d.imageUrl || d.heroImageUrl);
  const withoutImage = published.filter((d) => !d.imageUrl && !d.heroImageUrl);
  console.log(`\n🖼️  Image coverage (published):`);
  console.log(`  With image:    ${withImage.length}  (${pct(withImage.length, published.length)})`);
  console.log(`  Without image: ${withoutImage.length}  (${pct(withoutImage.length, published.length)})`);

  // Image source types from items
  const imgSources = counter(pubItems.map((i) => i.imageSource ?? "none"));
  console.log("  Image source breakdown:");
  for (const [s, n] of Object.entries(imgSources).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(20)} ${String(n).padStart(5)}`);
  }

  // --- 1i. Content freshness ---
  const recentPub = published.filter((d) => {
    const ts = d.createdAt?.toDate?.() ?? new Date(0);
    return ts > ago(7).toDate();
  });
  const weekOldPub = published.filter((d) => {
    const ts = d.createdAt?.toDate?.() ?? new Date(0);
    return ts > ago(14).toDate() && ts <= ago(7).toDate();
  });
  console.log(`\n⏰ Content freshness:`);
  console.log(`  Last 7 days:  ${recentPub.length} published`);
  console.log(`  7–14 days:    ${weekOldPub.length} published`);

  // --- 1j. Drafts & review queue ---
  const drafts = docs.filter((d) => d.status === "draft");
  const reviews = docs.filter((d) => d.status === "review");
  console.log(`\n📝 Pending content:`);
  console.log(`  Drafts:       ${drafts.length}`);
  console.log(`  In review:    ${reviews.length}`);

  // --- 1k. Items without content_versions ---
  const itemsWithCV = new Set(docs.map((d) => d.itemId).filter(Boolean));
  const allItemIds = new Set(allItems.docs.map((d) => d.id));
  const orphanItems = [...allItemIds].filter((id) => !itemsWithCV.has(id));
  console.log(`  Items without any content version: ${orphanItems.length}`);

  // --- 1l. Opportunity / deadline coverage ---
  const opItems = pubItems.filter((i) => i.itemType === "opportunity" || i.opportunity);
  const opWithDeadline = opItems.filter((i) => i.opportunity?.deadline);
  const opExpired = opWithDeadline.filter((i) => {
    try {
      return new Date(i.opportunity.deadline) < now;
    } catch {
      return false;
    }
  });
  console.log(`\n🎓 Opportunity content:`);
  console.log(`  Total opportunities:   ${opItems.length}`);
  console.log(`  With deadline:         ${opWithDeadline.length}`);
  console.log(`  Expired deadlines:     ${opExpired.length}`);

  return { docs, published, items, pubItems, sources: sourceMap };
}

/* ------------------------------------------------------------------ */
/*  2. INSTAGRAM AUDIT — ig_queue + ig_story_queue                    */
/* ------------------------------------------------------------------ */

async function auditInstagram() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  INSTAGRAM CONTENT AUDIT");
  console.log("═".repeat(60));

  // --- 2a. ig_queue overview ---
  const allIg = await db.collection("ig_queue").get();
  const igDocs = allIg.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  console.log(`\nTotal ig_queue entries: ${igDocs.length}`);

  const igStatuses = counter(igDocs.map((d) => d.status ?? "unknown"));
  console.log("\n📊 IG Queue status funnel:");
  const statusOrder = ["queued", "scheduled", "rendering", "posted", "scheduled_ready_for_manual", "skipped", "failed", "error"];
  for (const s of statusOrder) {
    if (igStatuses[s]) {
      console.log(`  ${s.padEnd(30)} ${String(igStatuses[s]).padStart(5)}  (${pct(igStatuses[s], igDocs.length)})`);
    }
  }
  // Any other statuses
  for (const [s, n] of Object.entries(igStatuses)) {
    if (!statusOrder.includes(s)) {
      console.log(`  ${s.padEnd(30)} ${String(n).padStart(5)}  (${pct(n, igDocs.length)})`);
    }
  }

  // --- 2b. IG content types ---
  const igTypes = counter(igDocs.map((d) => d.igType ?? d.type ?? "unknown"));
  console.log("\n📋 IG content types:");
  for (const [t, n] of Object.entries(igTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(25)} ${String(n).padStart(5)}  (${pct(n, igDocs.length)})`);
  }

  // --- 2c. Posted items analysis ---
  const posted = igDocs.filter((d) => d.status === "posted");
  console.log(`\n${BAR}`);
  console.log(`Total posted to IG: ${posted.length}`);

  // Posting cadence (last 14 days)
  const now = new Date();
  console.log("\n📅 IG posting cadence (last 14 days):");
  for (let d = 0; d < 14; d++) {
    const day = new Date(now.getTime() - d * 86_400_000);
    const dayStr = day.toISOString().slice(0, 10);
    const count = posted.filter((doc) => {
      const ts = doc.postedAt?.toDate?.() ?? doc.updatedAt?.toDate?.() ?? new Date(0);
      return ts.toISOString().slice(0, 10) === dayStr;
    }).length;
    const bar = "█".repeat(Math.min(count, 50));
    console.log(`  ${dayStr}  ${String(count).padStart(4)}  ${bar}`);
  }

  // --- 2d. Scheduling analysis ---
  const scheduled = igDocs.filter((d) => ["scheduled", "scheduled_ready_for_manual"].includes(d.status));
  console.log(`\n📌 Currently scheduled: ${scheduled.length}`);
  for (const s of scheduled.slice(0, 5)) {
    console.log(`  • ${s.igType ?? "?"} — slot: ${fmtDate(s.scheduledFor)} — score: ${s.score?.toFixed(2) ?? "?"}`);
  }

  // --- 2e. Failed/error items ---
  const failed = igDocs.filter((d) => ["failed", "error"].includes(d.status));
  console.log(`\n❌ Failed/errored: ${failed.length}`);
  if (failed.length > 0) {
    const reasons = counter(failed.map((d) => d.errorReason ?? d.error ?? "unknown"));
    console.log("  Error reasons:");
    for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`    ${r.slice(0, 60).padEnd(60)} ${n}`);
    }
  }

  // --- 2f. Render success rate ---
  const rendered = igDocs.filter((d) => d.status === "posted" || d.slides?.length > 0);
  const renderFailed = igDocs.filter(
    (d) => d.status === "failed" && (d.errorReason?.includes("render") || d.error?.includes("render"))
  );
  console.log(`\n🎨 Render pipeline:`);
  console.log(`  Successfully rendered: ${rendered.length}`);
  console.log(`  Render failures:       ${renderFailed.length}`);

  // --- 2g. IG score distribution ---
  const igScores = igDocs.map((d) => d.score).filter((s: any) => typeof s === "number") as number[];
  if (igScores.length > 0) {
    const avg = igScores.reduce((a, b) => a + b, 0) / igScores.length;
    const postedScores = posted.map((d) => d.score).filter((s: any) => typeof s === "number") as number[];
    const postedAvg = postedScores.length > 0 ? postedScores.reduce((a, b) => a + b, 0) / postedScores.length : 0;
    console.log(`\n🎯 IG content scores:`);
    console.log(`  Queue average:  ${avg.toFixed(2)}`);
    console.log(`  Posted average: ${postedAvg.toFixed(2)}`);
  }

  // --- 2h. Dry run vs. actual posts ---
  const dryRun = igDocs.filter((d) => d.status === "scheduled_ready_for_manual");
  const actualPosted = igDocs.filter((d) => d.status === "posted" && d.igMediaId);
  console.log(`\n📤 Publication mode:`);
  console.log(`  Actually posted (has IG media ID): ${actualPosted.length}`);
  console.log(`  Dry-run / manual:                  ${dryRun.length}`);

  // --- 2i. IG Story queue ---
  console.log(`\n${BAR}`);
  console.log("📖 IG STORIES:");
  const allStories = await db.collection("ig_story_queue").get();
  const storyDocs = allStories.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  console.log(`  Total story entries: ${storyDocs.length}`);

  if (storyDocs.length > 0) {
    const storyStatuses = counter(storyDocs.map((d) => d.status ?? "unknown"));
    for (const [s, n] of Object.entries(storyStatuses).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${s.padEnd(25)} ${String(n).padStart(5)}`);
    }

    const storyTypes = counter(storyDocs.map((d) => d.storyType ?? "unknown"));
    console.log("  Story types:");
    for (const [t, n] of Object.entries(storyTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${t.padEnd(20)} ${String(n).padStart(5)}`);
    }
  }

  // --- 2j. Content diversity on IG (last 30 days) ---
  const recent30 = posted.filter((d) => {
    const ts = d.postedAt?.toDate?.() ?? d.updatedAt?.toDate?.() ?? new Date(0);
    return ts > ago(30).toDate();
  });
  if (recent30.length > 0) {
    console.log(`\n📊 Content diversity (last 30 days, posted):`);
    const recentTypes = counter(recent30.map((d) => d.igType ?? "unknown"));
    for (const [t, n] of Object.entries(recentTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${t.padEnd(25)} ${String(n).padStart(5)}  (${pct(n, recent30.length)})`);
    }
  }

  return { igDocs, posted, storyDocs };
}

/* ------------------------------------------------------------------ */
/*  3. SOURCES HEALTH                                                  */
/* ------------------------------------------------------------------ */

async function auditSources() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  SOURCES HEALTH CHECK");
  console.log("═".repeat(60));

  const allSources = await db.collection("sources").get();
  const srcDocs = allSources.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const enabled = srcDocs.filter((d) => d.enabled);
  const disabled = srcDocs.filter((d) => !d.enabled);

  console.log(`\n  Total sources:    ${srcDocs.length}`);
  console.log(`  Enabled:          ${enabled.length}`);
  console.log(`  Disabled:         ${disabled.length}`);

  const sourceTypes = counter(enabled.map((d) => d.type ?? "unknown"));
  console.log("\n  Source types (enabled):");
  for (const [t, n] of Object.entries(sourceTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(15)} ${String(n).padStart(5)}`);
  }

  const priorities = counter(enabled.map((d) => d.priority ?? "normal"));
  console.log("\n  Priority (enabled):");
  for (const [p, n] of Object.entries(priorities).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${p.padEnd(15)} ${String(n).padStart(5)}`);
  }

  // Sources with errors in last tick
  const rawItems = await db.collection("raw_items")
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();
  const recentRaw = rawItems.docs.map((d) => d.data());
  const activeSourceIds = new Set(recentRaw.map((d) => d.sourceId));
  const dormant = enabled.filter((s) => !activeSourceIds.has(s.id));
  if (dormant.length > 0) {
    console.log(`\n  ⚠️  Enabled sources with NO recent raw_items (possibly broken):`);
    for (const s of dormant.slice(0, 15)) {
      console.log(`    • ${(s.name ?? s.id).slice(0, 50)}`);
    }
    if (dormant.length > 15) console.log(`    ... and ${dormant.length - 15} more`);
  }
}

/* ------------------------------------------------------------------ */
/*  4. UTILITY / ORIGINAL CONTENT                                      */
/* ------------------------------------------------------------------ */

async function auditUtility() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  UTILITY / ORIGINAL CONTENT");
  console.log("═".repeat(60));

  const queue = await db.collection("utility_queue").get();
  const qDocs = queue.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  console.log(`\n  Total utility_queue: ${qDocs.length}`);

  const uStatuses = counter(qDocs.map((d) => d.status ?? "unknown"));
  console.log("  Status:");
  for (const [s, n] of Object.entries(uStatuses).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(20)} ${String(n).padStart(5)}`);
  }

  const uTypes = counter(qDocs.map((d) => d.utilityType ?? "unknown"));
  console.log("  Content types:");
  for (const [t, n] of Object.entries(uTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(25)} ${String(n).padStart(5)}`);
  }
}

/* ------------------------------------------------------------------ */
/*  5. HISTORY CONTENT                                                 */
/* ------------------------------------------------------------------ */

async function auditHistory() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  HAITI HISTORY CONTENT");
  console.log("═".repeat(60));

  const almanac = await db.collection("haiti_history_almanac").get();
  const publishLog = await db.collection("history_publish_log").get();
  const holidays = await db.collection("haiti_holidays").get();

  console.log(`\n  Almanac entries:      ${almanac.size}`);
  console.log(`  Publish log entries:  ${publishLog.size}`);
  console.log(`  Holiday entries:      ${holidays.size}`);

  // Check month coverage
  const monthDays = almanac.docs.map((d) => d.data().monthDay as string).filter(Boolean);
  const months = counter(monthDays.map((md) => md.slice(0, 2)));
  console.log("\n  Almanac entries per month:");
  for (let m = 1; m <= 12; m++) {
    const key = String(m).padStart(2, "0");
    console.log(`    ${key}  ${String(months[key] ?? 0).padStart(4)}`);
  }

  // Days with no entry
  const uniqueDays = new Set(monthDays);
  console.log(`\n  Unique monthDay values: ${uniqueDays.size} / 366`);
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("🔍 EdLight News — Full Content Audit");
  console.log(`   Run at: ${new Date().toISOString()}`);

  await auditWebsite();
  await auditInstagram();
  await auditSources();
  await auditUtility();
  await auditHistory();

  console.log("\n\n" + "═".repeat(60));
  console.log("  AUDIT COMPLETE");
  console.log("═".repeat(60) + "\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
