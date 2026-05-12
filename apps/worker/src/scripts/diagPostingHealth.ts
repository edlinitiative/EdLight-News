/**
 * diagPostingHealth — one-shot health check for the IG posting pipeline.
 *
 * Answers, in a single run, the three questions that explain "no posts since
 * the last deploy":
 *
 *   A) When was the last successful publish (any igType)?
 *   B) What does the queue look like over the last 24h, broken down by status
 *      and igType?
 *   C) Which items are stuck in `scheduled_ready_for_manual` and why?
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker diag:posting-health
 *
 * Read-only — never mutates Firestore.
 */

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";

type AnyTs =
  | { seconds?: number; toMillis?: () => number }
  | Date
  | string
  | number
  | undefined
  | null;

function tsToMs(t: AnyTs): number | null {
  if (t === null || t === undefined) return null;
  if (t instanceof Date) return t.getTime();
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const parsed = Date.parse(t);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof (t as any).toMillis === "function") return (t as any).toMillis();
  if (typeof (t as any).seconds === "number") return (t as any).seconds * 1000;
  return null;
}

function fmtAge(ms: number | null): string {
  if (ms === null) return "?";
  const ageH = (Date.now() - ms) / 3_600_000;
  if (ageH < 1) return `${Math.round(ageH * 60)}m`;
  if (ageH < 48) return `${ageH.toFixed(1)}h`;
  return `${(ageH / 24).toFixed(1)}d`;
}

function fmtDate(ms: number | null): string {
  if (ms === null) return "(none)";
  return new Date(ms).toISOString();
}

async function main() {
  const db = getDb();

  // ── A) Last successful publish ─────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  A) Last published IG post");
  console.log("══════════════════════════════════════════════════════════════");
  const postedSnap = await db
    .collection("ig_queue")
    .where("status", "==", "posted")
    .orderBy("updatedAt", "desc")
    .limit(5)
    .get();

  if (postedSnap.empty) {
    console.log("  (no posted items found in ig_queue at all)");
  } else {
    for (const doc of postedSnap.docs) {
      const d = doc.data() as any;
      const updatedMs = tsToMs(d.updatedAt);
      const heading =
        d.payload?.slides?.[0]?.heading?.slice(0, 70) ?? "(no heading)";
      console.log(
        `  • ${doc.id}  igType=${d.igType}  postedAgo=${fmtAge(updatedMs)}  igPostId=${d.igPostId ?? "?"}`,
      );
      console.log(`      heading: "${heading}"`);
      console.log(`      updatedAt: ${fmtDate(updatedMs)}`);
    }
  }

  // ── B) ig_queue activity over the last 24h ─────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  B) ig_queue activity (last 24h, by status × igType)");
  console.log("══════════════════════════════════════════════════════════════");
  const cutoff24h = new Date(Date.now() - 24 * 3_600_000);
  const recentSnap = await db
    .collection("ig_queue")
    .where("updatedAt", ">=", cutoff24h)
    .get();

  const byStatusType: Record<string, Record<string, number>> = {};
  const byStatusTotal: Record<string, number> = {};
  for (const doc of recentSnap.docs) {
    const d = doc.data() as any;
    const s = d.status ?? "unknown";
    const t = d.igType ?? "unknown";
    byStatusType[s] ??= {};
    byStatusType[s][t] = (byStatusType[s][t] ?? 0) + 1;
    byStatusTotal[s] = (byStatusTotal[s] ?? 0) + 1;
  }

  if (recentSnap.empty) {
    console.log("  (no ig_queue activity in the last 24h — buildIgQueue is not running, or not finding items)");
  } else {
    const sortedStatuses = Object.keys(byStatusTotal).sort(
      (a, b) => byStatusTotal[b]! - byStatusTotal[a]!,
    );
    for (const status of sortedStatuses) {
      console.log(`  ${status.padEnd(34)} total=${byStatusTotal[status]}`);
      const types = byStatusType[status]!;
      for (const t of Object.keys(types).sort()) {
        console.log(`      ${t.padEnd(20)} ${types[t]}`);
      }
    }
  }

  // ── C) Items currently stuck in scheduled_ready_for_manual ─────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  C) Items held for manual review (status=scheduled_ready_for_manual)");
  console.log("══════════════════════════════════════════════════════════════");
  const heldSnap = await db
    .collection("ig_queue")
    .where("status", "==", "scheduled_ready_for_manual")
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();

  if (heldSnap.empty) {
    console.log("  (none — quality gate is not the blocker)");
  } else {
    console.log(`  Showing ${heldSnap.size} most-recent held item(s):\n`);
    // Aggregate hold reasons across all held items
    const reasonCounts: Record<string, number> = {};
    for (const doc of heldSnap.docs) {
      const d = doc.data() as any;
      const updatedMs = tsToMs(d.updatedAt);
      const heading =
        d.payload?.slides?.[0]?.heading?.slice(0, 70) ?? "(no heading)";
      const holdReasons = (d.reasons ?? []).filter((r: string) =>
        r.startsWith("Quality hold:"),
      );
      console.log(
        `  • ${doc.id}  igType=${d.igType}  ageSinceHold=${fmtAge(updatedMs)}`,
      );
      console.log(`      heading: "${heading}"`);
      for (const r of holdReasons) {
        console.log(`      ${r}`);
        const key = r.replace(/^Quality hold:\s*/, "").slice(0, 80);
        reasonCounts[key] = (reasonCounts[key] ?? 0) + 1;
      }
    }
    console.log("\n  ── Hold reason frequency (top 10) ──");
    const sortedReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [reason, count] of sortedReasons) {
      console.log(`  ${String(count).padStart(3)}× ${reason}`);
    }
  }

  // ── D) Items currently scheduled but not yet due / overdue ─────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  D) Currently scheduled items (status=scheduled)");
  console.log("══════════════════════════════════════════════════════════════");
  const schedSnap = await db
    .collection("ig_queue")
    .where("status", "==", "scheduled")
    .orderBy("scheduledFor", "asc")
    .limit(20)
    .get();

  if (schedSnap.empty) {
    console.log("  (none scheduled — scheduler hasn't picked up queued items, or queue is empty)");
  } else {
    let overdueCount = 0;
    for (const doc of schedSnap.docs) {
      const d = doc.data() as any;
      const schedMs = tsToMs(d.scheduledFor);
      const isOverdue = schedMs !== null && schedMs < Date.now();
      if (isOverdue) overdueCount++;
      const heading =
        d.payload?.slides?.[0]?.heading?.slice(0, 70) ?? "(no heading)";
      const tag = isOverdue ? "OVERDUE " : "        ";
      console.log(
        `  ${tag}${doc.id}  igType=${d.igType}  scheduledFor=${fmtDate(schedMs)}  in=${schedMs ? `${((schedMs - Date.now()) / 60000).toFixed(0)}m` : "?"}`,
      );
      console.log(`      heading: "${heading}"`);
    }
    if (overdueCount > 0) {
      console.log(
        `\n  ⚠ ${overdueCount} item(s) overdue — processIgScheduled has not picked them up. Check Cloud Run logs.`,
      );
    }
  }

  // ── E) Tail of recent skipped items (in case publishing tries and bails) ─
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  E) Recently skipped items (last 24h)");
  console.log("══════════════════════════════════════════════════════════════");
  const skippedSnap = await db
    .collection("ig_queue")
    .where("status", "==", "skipped")
    .orderBy("updatedAt", "desc")
    .limit(10)
    .get();

  if (skippedSnap.empty) {
    console.log("  (none)");
  } else {
    for (const doc of skippedSnap.docs) {
      const d = doc.data() as any;
      const updatedMs = tsToMs(d.updatedAt);
      const lastReason = (d.reasons ?? []).slice(-1)[0] ?? "(no reason)";
      console.log(
        `  • ${doc.id}  igType=${d.igType}  ago=${fmtAge(updatedMs)}  reason=${lastReason}`,
      );
    }
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Done.");
  console.log("══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[diagPostingHealth] fatal:", err);
  process.exit(1);
});
