/**
 * History / Fait-du-jour diagnostic — queries Firestore to surface issues.
 */
import { getDb } from "@edlight-news/firebase";

async function main() {
  const db = getDb();

  // ── 1. Recent history_publish_log ────────────────────────────────────
  console.log("\n═══ 1. HISTORY PUBLISH LOG (last 30 days) ═══");
  const logSnap = await db
    .collection("history_publish_log")
    .orderBy("dateISO", "desc")
    .limit(30)
    .get();

  const logs = logSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  console.log(`Total log entries found: ${logSnap.size}`);

  let doneCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const failedDates: string[] = [];
  const skippedDates: string[] = [];

  for (const log of logs) {
    if (log.status === "done") doneCount++;
    else if (log.status === "failed") {
      failedCount++;
      failedDates.push(log.dateISO);
    } else if (log.status === "skipped") {
      skippedCount++;
      skippedDates.push(log.dateISO);
    }
    console.log(
      `  ${log.dateISO} → ${log.status}${log.error ? ` | ERROR: ${log.error}` : ""}${log.validationWarnings?.length ? ` | WARN: ${log.validationWarnings.join("; ")}` : ""}${log.publishedItemId ? ` | item=${log.publishedItemId}` : ""}`,
    );
  }
  console.log(`\nSummary: done=${doneCount}, failed=${failedCount}, skipped=${skippedCount}`);
  if (failedDates.length) console.log(`Failed dates: ${failedDates.join(", ")}`);
  if (skippedDates.length) console.log(`Skipped dates: ${skippedDates.join(", ")}`);

  // Check for gaps (days with no log entry in last 14 days)
  const today = new Date();
  const missingDates: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (!logs.find((l: any) => l.dateISO === iso)) {
      missingDates.push(iso);
    }
  }
  if (missingDates.length) {
    console.log(`\n⚠️  Missing log entries for last 14 days: ${missingDates.join(", ")}`);
  } else {
    console.log(`\n✅ No gaps in the last 14 days`);
  }

  // ── 2. History items + content_versions ──────────────────────────────
  console.log("\n═══ 2. HISTORY ITEMS & CONTENT VERSIONS ═══");
  // Use simple equality query (no composite index needed) then sort in-memory
  const historyItemsSnap = await db
    .collection("items")
    .where("utilityMeta.series", "==", "HaitiHistory")
    .limit(50)
    .get();
  // Sort in memory by createdAt desc
  const historyDocs = historyItemsSnap.docs
    .sort((a, b) => {
      const aT = a.data().createdAt?.toDate?.()?.getTime?.() ?? 0;
      const bT = b.data().createdAt?.toDate?.()?.getTime?.() ?? 0;
      return bT - aT;
    })
    .slice(0, 20);

  console.log(`Recent HaitiHistory items: ${historyDocs.length}`);
  let itemsWithImage = 0;
  let itemsWithoutImage = 0;

  for (const doc of historyDocs) {
    const item = doc.data();
    const hasImg = !!item.imageUrl;
    if (hasImg) itemsWithImage++;
    else itemsWithoutImage++;
    console.log(
      `  ${doc.id} | ${item.title?.slice(0, 60)}… | img=${hasImg ? "✓" : "✗"} | conf=${item.confidence} | created=${item.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? "?"}`,
    );
  }
  console.log(`Images: ${itemsWithImage} with, ${itemsWithoutImage} without`);

  // Check content_versions for a few of these items
  console.log("\n── Content versions for last 5 history items ──");
  const recentHistoryItems = historyDocs.slice(0, 5);
  for (const doc of recentHistoryItems) {
    const item = doc.data();
    const cvSnap = await db
      .collection("content_versions")
      .where("itemId", "==", doc.id)
      .get();

    const versions = cvSnap.docs.map((d) => d.data());
    const langs = versions.map((v: any) => v.language);
    const statuses = versions.map((v: any) => `${v.language}:${v.status}`);
    console.log(
      `  ${doc.id} | "${item.title?.slice(0, 50)}" | CVs: ${cvSnap.size} (${statuses.join(", ")})`,
    );

    // Check Creole content quality — is HT text actually different from FR?
    const frCV = versions.find((v: any) => v.language === "fr") as any;
    const htCV = versions.find((v: any) => v.language === "ht") as any;
    if (frCV && htCV) {
      const frBody = (frCV.body || "").slice(0, 200);
      const htBody = (htCV.body || "").slice(0, 200);
      const identical = frBody === htBody;
      if (identical) {
        console.log(`    ⚠️  FR and HT body are IDENTICAL (fake bilingual)`);
      } else {
        // Check similarity — if >80% same chars, likely just header swap
        const overlap = frBody.split("").filter((c: string, i: number) => c === htBody[i]).length;
        const similarity = frBody.length > 0 ? (overlap / frBody.length) * 100 : 0;
        if (similarity > 80) {
          console.log(`    ⚠️  FR/HT similarity: ${similarity.toFixed(0)}% (likely French with Creole headers)`);
        } else {
          console.log(`    ✅ FR/HT appear distinct (${similarity.toFixed(0)}% char overlap)`);
        }
      }
      // Show first 100 chars of each for comparison
      console.log(`    FR: ${frBody.slice(0, 100)}…`);
      console.log(`    HT: ${htBody.slice(0, 100)}…`);
    } else {
      console.log(`    ⚠️  Missing language version: langs=${langs.join(",")}`);
    }
  }

  // ── 3. IG queue for history posts ────────────────────────────────────
  console.log("\n═══ 3. IG QUEUE — HISTORY POSTS ═══");
  // Avoid composite index — pull recent IG entries and filter in memory
  const igAllSnap = await db
    .collection("ig_queue")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const igHistoryDocs = igAllSnap.docs.filter(
    (d) => d.data().igContentType === "daily_fact",
  );

  console.log(`daily_fact entries in ig_queue (from last 100): ${igHistoryDocs.length}`);
  const igByStatus: Record<string, number> = {};
  for (const doc of igHistoryDocs) {
    const d = doc.data();
    igByStatus[d.status] = (igByStatus[d.status] || 0) + 1;
    console.log(
      `  ${doc.id} | status=${d.status} | ${d.title?.slice(0, 50)}… | created=${d.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? "?"}${d.igPostId ? " | posted ✓" : ""}${d.lastError ? ` | ERR: ${d.lastError.slice(0, 80)}` : ""}`,
    );
  }
  console.log(`By status:`, igByStatus);

  // Also check ig_story_queue for history
  const igStoryAllSnap = await db
    .collection("ig_story_queue")
    .limit(50)
    .get();
  const igStoryHistory = igStoryAllSnap.docs.filter(
    (d) => d.data().igContentType === "daily_fact",
  );
  console.log(`daily_fact entries in ig_story_queue: ${igStoryHistory.length}`);

  // ── 4. Almanac coverage check ────────────────────────────────────────
  console.log("\n═══ 4. ALMANAC COVERAGE ═══");
  const almanacSnap = await db.collection("haiti_history_almanac").get();
  const monthDays = new Set<string>();
  let wikiOnlyCount = 0;
  let totalEntries = 0;
  let lowConfCount = 0;

  for (const doc of almanacSnap.docs) {
    const e = doc.data();
    monthDays.add(e.monthDay);
    totalEntries++;
    if (e.confidence === "low") lowConfCount++;
    const sources = e.sources || [];
    const allWiki = sources.length > 0 && sources.every((s: any) =>
      (s.url || "").toLowerCase().includes("wikipedia"),
    );
    if (allWiki) wikiOnlyCount++;
  }

  console.log(`Total almanac entries: ${totalEntries}`);
  console.log(`Unique monthDays covered: ${monthDays.size} / 366`);
  console.log(`Wikipedia-only sourced: ${wikiOnlyCount} (${((wikiOnlyCount / totalEntries) * 100).toFixed(1)}%)`);
  console.log(`Low confidence: ${lowConfCount}`);

  // Check verified raw entries
  const rawSnap = await db
    .collection("haiti_history_almanac_raw")
    .where("verified", "==", true)
    .get();
  console.log(`\nVerified raw entries: ${rawSnap.size}`);

  // ── 5. Utility queue HaitiHistory / HaitiFactOfTheDay ────────────────
  console.log("\n═══ 5. UTILITY QUEUE — HISTORY SERIES ═══");
  // Pull all recent utility_queue entries and filter in memory
  const uqAllSnap = await db
    .collection("utility_queue")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  for (const series of ["HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]) {
    const matching = uqAllSnap.docs.filter((d) => d.data().series === series).slice(0, 5);
    console.log(`\n${series}: ${matching.length} recent entries (from last 100)`);
    for (const doc of matching) {
      const d = doc.data();
      console.log(
        `  ${doc.id} | status=${d.status} | ${d.title?.slice(0, 50) ?? "(no title)"}… | created=${d.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? "?"}${d.error ? ` | ERR: ${d.error.slice(0, 80)}` : ""}`,
      );
    }
  }

  // ── 6. Web frontend disconnect check ─────────────────────────────────
  console.log("\n═══ 6. WEB FRONTEND DATA CHECK ═══");
  // The /histoire page reads from haiti_history_almanac directly.
  // Check if today's almanac entries exist and what they look like
  const todayMM = String(new Date().getMonth() + 1).padStart(2, "0");
  const todayDD = String(new Date().getDate()).padStart(2, "0");
  const todayMD = `${todayMM}-${todayDD}`;

  const todayAlmanac = await db
    .collection("haiti_history_almanac")
    .where("monthDay", "==", todayMD)
    .get();

  console.log(`Today (${todayMD}) almanac entries: ${todayAlmanac.size}`);
  for (const doc of todayAlmanac.docs) {
    const e = doc.data();
    console.log(`  ${doc.id} | ${e.year} — ${e.name} | conf=${e.confidence}`);
    console.log(`    name_ht: ${e.name_ht || "⚠️ MISSING"}`);
    console.log(`    description_ht: ${(e.description_ht || "⚠️ MISSING").slice(0, 80)}`);
    console.log(`    illustration: ${e.illustration?.imageUrl ? "✓" : "✗"}`);
    console.log(`    sources: ${(e.sources || []).map((s: any) => s.label).join(", ")}`);
  }

  // Today's content_versions (the generated ones the web doesn't show)
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l: any) => l.dateISO === todayISO);
  if (todayLog?.publishedItemId) {
    const todayCVs = await db
      .collection("content_versions")
      .where("itemId", "==", todayLog.publishedItemId)
      .get();
    console.log(`\nToday's published content_versions (item=${todayLog.publishedItemId}): ${todayCVs.size}`);
    for (const doc of todayCVs.docs) {
      const cv = doc.data();
      console.log(`  ${cv.language} | ${cv.title} | body length: ${(cv.body || "").length} chars`);
    }
    console.log(`\n⚠️  The /histoire web page reads DIRECTLY from haiti_history_almanac,`);
    console.log(`   NOT from these generated content_versions. The LLM-rewritten`);
    console.log(`   narrative articles are invisible on the website.`);
  }

  console.log("\n═══ DIAGNOSTIC COMPLETE ═══\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Diagnostic failed:", err);
  process.exit(1);
});
