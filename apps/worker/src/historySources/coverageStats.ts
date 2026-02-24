/**
 * Almanac Coverage Statistics
 *
 * Reports how well the raw almanac covers the 366-day calendar:
 *   - Total entries
 *   - Days with ≥1 event
 *   - Days with ≥3 events (rich days)
 *   - Empty days (no events at all)
 *   - Verification stats
 *
 * Run:
 *   pnpm --filter @edlight-news/worker run coverage:almanac
 */

import { haitiHistoryAlmanacRawRepo } from "@edlight-news/firebase";
import type { HaitiHistoryAlmanacRaw } from "@edlight-news/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AlmanacCoverageStats {
  totalEntries: number;
  verifiedEntries: number;
  unverifiedEntries: number;
  daysWithAtLeast1: number;
  daysWithAtLeast3: number;
  daysWithAtLeast5: number;
  emptyDays: number;
  /** Percentage of 366 days covered (≥1 entry). */
  coveragePercent: number;
  /** Month-by-month breakdown. */
  byMonth: MonthStats[];
  /** List of MM-DD strings with no events. */
  emptyDaysList: string[];
}

export interface MonthStats {
  month: string; // "01", "02", ...
  entries: number;
  daysWithEvents: number;
  daysInMonth: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** All 366 possible MM-DD values (includes Feb 29). */
function generateAllMonthDays(): string[] {
  const daysPerMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const result: string[] = [];
  for (let m = 0; m < 12; m++) {
    const mm = String(m + 1).padStart(2, "0");
    for (let d = 1; d <= daysPerMonth[m]!; d++) {
      const dd = String(d).padStart(2, "0");
      result.push(`${mm}-${dd}`);
    }
  }
  return result;
}

const DAYS_PER_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ── Main ─────────────────────────────────────────────────────────────────────

export async function getAlmanacCoverageStats(): Promise<AlmanacCoverageStats> {
  const allEntries = await haitiHistoryAlmanacRawRepo.listAll();
  const allDays = generateAllMonthDays();

  // Group by monthDay
  const byDay = new Map<string, HaitiHistoryAlmanacRaw[]>();
  for (const entry of allEntries) {
    const list = byDay.get(entry.monthDay) ?? [];
    list.push(entry);
    byDay.set(entry.monthDay, list);
  }

  // Compute per-day stats
  let daysWithAtLeast1 = 0;
  let daysWithAtLeast3 = 0;
  let daysWithAtLeast5 = 0;
  const emptyDaysList: string[] = [];

  for (const day of allDays) {
    const count = byDay.get(day)?.length ?? 0;
    if (count >= 1) daysWithAtLeast1++;
    if (count >= 3) daysWithAtLeast3++;
    if (count >= 5) daysWithAtLeast5++;
    if (count === 0) emptyDaysList.push(day);
  }

  // Verification stats
  const verifiedEntries = allEntries.filter(
    (e) => e.verificationStatus === "verified",
  ).length;
  const unverifiedEntries = allEntries.length - verifiedEntries;

  // Month breakdown
  const byMonth: MonthStats[] = [];
  for (let m = 0; m < 12; m++) {
    const mm = String(m + 1).padStart(2, "0");
    const monthEntries = allEntries.filter((e) => e.monthDay.startsWith(`${mm}-`));
    const monthDays = allDays.filter((d) => d.startsWith(`${mm}-`));
    const daysWithEvents = monthDays.filter((d) => (byDay.get(d)?.length ?? 0) > 0).length;

    byMonth.push({
      month: mm,
      entries: monthEntries.length,
      daysWithEvents,
      daysInMonth: DAYS_PER_MONTH[m]!,
    });
  }

  return {
    totalEntries: allEntries.length,
    verifiedEntries,
    unverifiedEntries,
    daysWithAtLeast1,
    daysWithAtLeast3,
    daysWithAtLeast5,
    emptyDays: emptyDaysList.length,
    coveragePercent: Math.round((daysWithAtLeast1 / 366) * 100 * 10) / 10,
    byMonth,
    emptyDaysList,
  };
}

/**
 * Pretty-print coverage stats to console.
 */
export function printCoverageStats(stats: AlmanacCoverageStats): void {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  📊 Haiti History Almanac — Coverage Report");
  console.log("══════════════════════════════════════════════════════\n");

  console.log(`  Total entries:        ${stats.totalEntries}`);
  console.log(`  Verified:             ${stats.verifiedEntries}`);
  console.log(`  Unverified:           ${stats.unverifiedEntries}`);
  console.log(`  Days with ≥1 event:   ${stats.daysWithAtLeast1} / 366`);
  console.log(`  Days with ≥3 events:  ${stats.daysWithAtLeast3} / 366`);
  console.log(`  Days with ≥5 events:  ${stats.daysWithAtLeast5} / 366`);
  console.log(`  Empty days:           ${stats.emptyDays}`);
  console.log(`  Coverage:             ${stats.coveragePercent}%\n`);

  console.log("  Month breakdown:");
  console.log("  ────────────────────────────────────────────");
  for (const m of stats.byMonth) {
    const pct = m.daysInMonth > 0
      ? Math.round((m.daysWithEvents / m.daysInMonth) * 100)
      : 0;
    console.log(
      `  Month ${m.month}: ${String(m.entries).padStart(4)} entries, ${m.daysWithEvents}/${m.daysInMonth} days covered (${pct}%)`,
    );
  }

  if (stats.emptyDays > 0 && stats.emptyDays <= 30) {
    console.log(`\n  Empty days: ${stats.emptyDaysList.join(", ")}`);
  } else if (stats.emptyDays > 30) {
    console.log(`\n  Empty days: ${stats.emptyDaysList.slice(0, 30).join(", ")} ... and ${stats.emptyDays - 30} more`);
  }

  console.log("\n══════════════════════════════════════════════════════\n");
}
