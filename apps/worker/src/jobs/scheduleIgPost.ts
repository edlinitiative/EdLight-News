/**
 * Worker job: scheduleIgPost
 *
 * Runs on every tick. Guarantees the 3 daily staple posts (taux, histoire,
 * utility/fait-du-jour) are scheduled FIRST, then fills up to 5 more
 * regular posts for a total of 8/day (10 if urgent score ≥ 90).
 *
 * In a single tick the scheduler will:
 *  1. Expire stale items (queued + overdue scheduled)
 *  2. Schedule ALL missing daily staples at once (up to 3)
 *  3. Schedule 1 additional regular post if under the daily cap
 *
 * Rules:
 * - 3 daily staples guaranteed: taux, histoire, utility (fait-du-jour)
 * - Up to 5 additional regular posts (8 total / 10 for urgent ≥ 90)
 * - Quiet hours: 23:00–07:00 Haiti time (America/Port-au-Prince)
 * - 9 slots spread across the day for best engagement
 * - Per-type caps prevent any single type from dominating the feed
 */

import { igQueueRepo } from "@edlight-news/firebase";
import type { IGPostType } from "@edlight-news/types";
import { STALENESS_TTL_HOURS, isStale } from "./igStaleness.js";

// Re-export so existing consumers (tests, scripts) keep working.
export { STALENESS_TTL_HOURS, isStale };

// Haiti timezone
const HAITI_TZ = "America/Port-au-Prince";

// ── Per-type daily caps ─────────────────────────────────────────────────────
// Prevent any single type from dominating the feed. undefined = no cap.
/** @internal exported for tests */
export const TYPE_DAILY_CAPS: Partial<Record<IGPostType, number>> = {
  scholarship: 3,
  opportunity: 2,
  taux: 1,
};

// ── Daily staples: types that MUST post every day ───────────────────────────
// These are scheduled in bulk before any regular items.
// Order matters — first gets the earliest morning slot.
/** @internal exported for tests */
export const DAILY_STAPLES: IGPostType[] = ["taux", "histoire", "utility"];

// ── Daily cap: 3 staples + 5 regular = 8 (10 for urgent) ───────────────────
/** @internal exported for tests */
export const DAILY_CAP_NORMAL = 8;
/** @internal exported for tests */
export const DAILY_CAP_URGENT = 10; // for items with score >= 90

/** Maps staple types to their pinned slot index in SLOTS. @internal exported for tests */
export const STAPLE_SLOT_INDEX: Record<string, number> = {
  taux: 0,       // 06:30
  utility: 1,    // 06:50
  histoire: 2,   // 07:00
};

export interface ScheduleIgPostResult {
  scheduled: number;
  skipped: string;
  expired: number;
}



/** @internal exported for tests */
export function toHaitiDate(date: Date): Date {
  // Convert a UTC Date to a "fake" Date whose UTC clock shows Haiti local time.
  // Uses Intl.DateTimeFormat parts to avoid the DST-ambiguous toLocaleString approach.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  // Build an ISO string treated as UTC so getUTCHours() gives the Haiti hour.
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`);
}

/** @internal exported for tests */
export function isQuietHour(date: Date): boolean {
  const haitiDate = toHaitiDate(date);
  const hour = haitiDate.getUTCHours();
  const minute = haitiDate.getUTCMinutes();
  // Quiet hours: 23:00–05:29 Haiti time (opens at 05:30 for morning posts)
  return hour >= 23 || hour < 5 || (hour === 5 && minute < 30);
}

/**
 * Compute the current UTC offset for Haiti dynamically.
 * Haiti observes US Eastern time rules (EST = UTC-5, EDT = UTC-4).
 * Returns the offset in hours (positive = behind UTC, e.g. 4 for EDT, 5 for EST).
 */
/** @internal exported for tests */
export function getHaitiOffsetHours(date: Date = new Date()): number {
  // Use the Intl API to get the reliable Haiti hour, then diff vs UTC.
  const haitiHour = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: HAITI_TZ, hour: "2-digit", hour12: false }).format(date),
    10,
  );
  const utcHour = date.getUTCHours();
  // diff may wrap around midnight — normalise to -12..+12
  let diff = utcHour - haitiHour;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff;
}

// Pinned morning slots for daily staples, followed by general engagement slots.
// First 3 are reserved for taux, daily_fact/utility, and histoire respectively.
/** @internal exported for tests */
export const SLOTS = [
  { hour: 6, minute: 30 },    // Pinned: taux du jour
  { hour: 6, minute: 50 },    // Pinned: fait du jour / utility
  { hour: 7, minute: 0 },     // Pinned: histoire
  { hour: 8, minute: 30 },    // Morning — general slot
  { hour: 10, minute: 0 },    // Mid-morning
  { hour: 11, minute: 30 },   // Late morning
  { hour: 14, minute: 0 },    // Early afternoon
  { hour: 16, minute: 0 },    // After school
  { hour: 18, minute: 0 },    // Evening
  { hour: 20, minute: 0 },    // Late evening
];

/**
 * Return the next available slot that isn't already taken.
 * `takenSlotISOs` contains ISO strings of slots already allocated this tick
 * (or by previously scheduled items).
 * When `todayOnly` is true the search is limited to today's remaining slots
 * (used for daily staples so they never spill into tomorrow).
 */
/** @internal exported for tests */
export function getNextAvailableSlot(takenSlotISOs: Set<string>, todayOnly = false): Date | null {
  const now = new Date();
  const haitiNow = toHaitiDate(now);
  const haitiHour = haitiNow.getUTCHours();
  const haitiMinute = haitiNow.getUTCMinutes();
  const offsetHours = getHaitiOffsetHours(now);

  const haitiYear = haitiNow.getUTCFullYear();
  const haitiMonth = haitiNow.getUTCMonth();
  const haitiDay = haitiNow.getUTCDate();

  const maxDayOffset = todayOnly ? 0 : 1;

  for (let dayOffset = 0; dayOffset <= maxDayOffset; dayOffset++) {
    for (const slot of SLOTS) {
      // If today, must be in the future
      if (dayOffset === 0) {
        if (
          haitiHour > slot.hour ||
          (haitiHour === slot.hour && haitiMinute >= slot.minute)
        ) {
          continue;
        }
      }

      const slotDate = new Date(
        Date.UTC(
          haitiYear,
          haitiMonth,
          haitiDay + dayOffset,
          slot.hour + offsetHours,
          slot.minute,
          0,
          0,
        ),
      );
      const iso = slotDate.toISOString();

      // Skip if this slot is already taken
      if (takenSlotISOs.has(iso)) continue;

      // Also skip if within 30 min of any taken slot (safety margin)
      let conflict = false;
      for (const taken of takenSlotISOs) {
        if (Math.abs(new Date(taken).getTime() - slotDate.getTime()) < 30 * 60 * 1000) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      return slotDate;
    }
  }

  return null; // all slots taken
}

/**
 * Return the soonest publishable instant for a daily staple whose pinned
 * morning slot has already passed. We deliberately bypass the general
 * engagement slots (08:30, 10:00, …, 14:00, …) because waiting hours to
 * post a "taux du jour" or "histoire" defeats their purpose — these are
 * time-sensitive staples that should land within minutes of being
 * generated.
 *
 * Behaviour:
 *  - Outside quiet hours: now + 60s (small offset per already-taken slot
 *    in this tick to keep collision-free ISO keys). The next tick of
 *    `processIgScheduled` (≤ a few minutes later) will publish it.
 *  - Inside quiet hours (23:00–05:30 Haiti): schedule for 05:30 Haiti so
 *    we don't push at 2am.
 *
 * @internal exported for tests
 */
export function getAsapStapleSlot(takenSlotISOs: Set<string>): Date {
  const now = new Date();
  // Stagger by 60s per already-claimed slot in this tick so multiple
  // staples promoted to ASAP on the same tick get distinct ISO keys.
  const stagger = takenSlotISOs.size * 60 * 1000;

  if (isQuietHour(now)) {
    // Schedule for end of quiet hours (05:30 Haiti) — that's the next
    // moment the system is allowed to publish anyway.
    const offsetHours = getHaitiOffsetHours(now);
    const haitiNow = toHaitiDate(now);
    let year = haitiNow.getUTCFullYear();
    let month = haitiNow.getUTCMonth();
    let day = haitiNow.getUTCDate();
    // If we're in the >=23h portion of quiet hours, end-of-quiet is tomorrow.
    if (haitiNow.getUTCHours() >= 23) day += 1;
    return new Date(
      Date.UTC(year, month, day, 5 + offsetHours, 30, 0, 0) + stagger,
    );
  }

  return new Date(now.getTime() + 60 * 1000 + stagger);
}

/** Return today's date in Haiti timezone as YYYY-MM-DD. */
function getHaitiTodayISO(): string {
  const haiti = toHaitiDate(new Date());
  const year = haiti.getUTCFullYear();
  const month = String(haiti.getUTCMonth() + 1).padStart(2, "0");
  const day = String(haiti.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** @internal exported for tests */
export function matchesTargetPostDate(
  item: { targetPostDate?: string },
  haitiToday: string,
): boolean {
  return !item.targetPostDate || item.targetPostDate === haitiToday;
}

export async function scheduleIgPost(): Promise<ScheduleIgPostResult> {
  let expired = 0;
  let totalScheduled = 0;

  // Check quiet hours
  if (isQuietHour(new Date())) {
    return { scheduled: 0, skipped: "quiet-hours", expired: 0 };
  }

  // ── Expire stale SCHEDULED items ────────────────────────────────────
  const allScheduled = await igQueueRepo.listAllScheduled(50);
  const now = new Date();
  for (const item of allScheduled) {
    // Admin-pushed items bypass staleness — the operator chose to publish them.
    const isManual = !!(item as any).manuallyScheduled;

    if (!isManual && isStale(item)) {
      await igQueueRepo.updateStatus(item.id, "expired", {
        reasons: [...(item.reasons ?? []), `Expired scheduled: exceeded ${STALENESS_TTL_HOURS[item.igType]}h TTL for ${item.igType}`],
      });
      expired++;
      continue;
    }
    if (item.scheduledFor) {
      const scheduledTime = new Date(item.scheduledFor).getTime();
      const overduMs = now.getTime() - scheduledTime;
      // Manual items get a longer grace period (6h vs 2h) so late-night
      // pushes survive until the next active tick window.
      const overdueThresholdMs = isManual ? 6 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
      if (overduMs > overdueThresholdMs) {
        await igQueueRepo.updateStatus(item.id, "expired", {
          reasons: [...(item.reasons ?? []), `Expired: scheduled slot missed by ${Math.round(overduMs / 3600000)}h (scheduledFor=${item.scheduledFor})`],
        });
        expired++;
      }
    }
  }
  if (expired > 0) {
    console.log(`[scheduleIgPost] expired ${expired} stale/overdue scheduled item(s)`);
  }

  // ── Gather today's state ─────────────────────────────────────────────
  const postedToday = await igQueueRepo.countPostedToday();
  const scheduledToday = await igQueueRepo.countScheduledToday();
  let totalToday = postedToday + scheduledToday;

  // Get a broader pool of queued items so we can enforce type diversity.
  // Use 50 (not 30) to ensure high-scoring carry-overs from prior days
  // aren't truncated out of the candidate pool.
  const queued = await igQueueRepo.listQueuedByScore(50);

  // ── Expire stale queued items ────────────────────────────────────────
  const fresh: typeof queued = [];
  for (const item of queued) {
    if (isStale(item)) {
      await igQueueRepo.updateStatus(item.id, "expired", {
        reasons: [...item.reasons, `Expired: exceeded ${STALENESS_TTL_HOURS[item.igType]}h TTL for ${item.igType}`],
      });
      expired++;
    } else {
      fresh.push(item);
    }
  }

  // ── Prefer items queued today, but don't starve high-scoring carry-overs ──
  // Use a weighted composite score: today's items get a +10 freshness bonus.
  // This gives modest preference to today's content when scores are close,
  // but genuinely high-scoring carry-overs (e.g. scholarship at 90 vs
  // news at 45) still win — preventing them from expiring unposted.
  const haitiToday = getHaitiTodayISO();
  const FRESHNESS_BONUS = 10;
  fresh.sort((a, b) => {
    const aBonus = (a as any).queuedDate === haitiToday ? FRESHNESS_BONUS : 0;
    const bBonus = (b as any).queuedDate === haitiToday ? FRESHNESS_BONUS : 0;
    return ((b.score ?? 0) + bBonus) - ((a.score ?? 0) + aBonus);
  });

  if (fresh.length === 0) {
    return { scheduled: 0, skipped: "no-queued-items", expired };
  }

  // ── Build set of already-taken slot times ────────────────────────────
  const scheduledItems = await igQueueRepo.listScheduled(20);
  const takenSlots = new Set<string>();
  for (const s of scheduledItems) {
    if (s.scheduledFor) takenSlots.add(new Date(s.scheduledFor).toISOString());
  }

  // ── What's already posted/scheduled today by type ────────────────────
  const todayStatuses = await igQueueRepo.listPostedAndScheduledToday();
  const todayTypeCounts = new Map<string, number>();
  for (const s of todayStatuses) {
    todayTypeCounts.set(s.igType, (todayTypeCounts.get(s.igType) ?? 0) + 1);
  }

  // Track items scheduled this tick so we don't double-pick from fresh[]
  const scheduledThisTick = new Set<string>();

  // ════════════════════════════════════════════════════════════════════
  // PHASE 1 — Schedule ALL missing daily staples in one pass
  //           with type-priority pinning to dedicated morning slots:
  //           taux → 06:30, utility/daily_fact → 06:50, histoire → 07:00
  // ════════════════════════════════════════════════════════════════════

  for (const stapleType of DAILY_STAPLES) {
    // Date-aware check: for types that carry a targetPostDate (e.g. histoire),
    // only consider an item as "already covered" if its targetPostDate matches
    // today. This prevents yesterday's spilled histoire from blocking today's.
    const alreadyCovered = todayStatuses.some(
      (s) =>
        s.igType === stapleType &&
        matchesTargetPostDate(s, haitiToday),
    );
    if (alreadyCovered) continue;

    const candidate = fresh.find(
      (q) =>
        q.igType === stapleType &&
        !scheduledThisTick.has(q.id) &&
        matchesTargetPostDate(q, haitiToday),
    );
    if (!candidate) {
      // ── Staple watchdog: warn when a daily staple has no candidate ────
      // This catches histoire generation failures, missing taux, or
      // utility gaps early so operators can investigate the upstream job.
      // Note: BRH sometimes publishes rates on Saturdays, so taux is NOT
      // excluded on weekends — the freshness gate in buildIgTaux handles it.
      console.warn(
        `[scheduleIgPost] ⚠️  STAPLE WATCHDOG: no "${stapleType}" candidate in queue for ${haitiToday}. ` +
        `Upstream job may have failed or produced no content.`,
      );
      continue; // no item of this type in queue
    }

    // Try the pinned slot first for this staple type
    const pinnedIdx = STAPLE_SLOT_INDEX[stapleType];
    let slot: Date | null = null;
    let pinnedAlreadyPassed = false;

    if (pinnedIdx != null) {
      // Build the pinned slot time for today
      const pinnedSlotDef = SLOTS[pinnedIdx]!;
      const offsetHours = getHaitiOffsetHours(new Date());
      const haitiNow = toHaitiDate(new Date());
      const pinnedDate = new Date(
        Date.UTC(
          haitiNow.getUTCFullYear(),
          haitiNow.getUTCMonth(),
          haitiNow.getUTCDate(),
          pinnedSlotDef.hour + offsetHours,
          pinnedSlotDef.minute,
          0, 0,
        ),
      );
      const pinnedISO = pinnedDate.toISOString();

      // Use the pinned slot if it's not taken and not in the past
      if (!takenSlots.has(pinnedISO) && pinnedDate > new Date()) {
        slot = pinnedDate;
      } else if (pinnedDate <= new Date()) {
        pinnedAlreadyPassed = true;
      }
    }

    // ASAP path: a daily staple whose pinned morning slot has passed should
    // post within the next tick (a few minutes), NOT slide into a 14:00 /
    // 16:00 general engagement slot. This is the difference between a
    // "taux du jour" landing at 06:31 vs. 15:00.
    if (!slot && pinnedAlreadyPassed) {
      slot = getAsapStapleSlot(takenSlots);
      console.log(
        `[scheduleIgPost] staple ${stapleType}: pinned slot already passed — promoting to ASAP slot ${slot.toISOString()}`,
      );
    }

    // Final fallback: a non-pinned staple, or pinned slot taken (not past).
    // Use the next available today-slot — never spill into tomorrow's morning.
    if (!slot) {
      slot = getNextAvailableSlot(takenSlots, /* todayOnly */ true);
    }

    if (!slot) {
      console.log(`[scheduleIgPost] no today-slot available for staple ${stapleType} — will retry next tick`);
      continue;
    }

    const slotISO = slot.toISOString();
    await igQueueRepo.setScheduled(candidate.id, slotISO);
    takenSlots.add(slotISO);
    scheduledThisTick.add(candidate.id);
    todayTypeCounts.set(stapleType, (todayTypeCounts.get(stapleType) ?? 0) + 1);
    totalToday++;
    totalScheduled++;
    console.log(
      `[scheduleIgPost] daily-staple: scheduled ${stapleType} item ${candidate.id} (score=${candidate.score}) → ${slotISO}`,
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // PHASE 2 — Schedule 1 regular item (if under daily cap)
  // ════════════════════════════════════════════════════════════════════

  // Determine effective cap — urgent content (score ≥ 90) gets higher cap
  const topFreshScore = fresh.find((f) => !scheduledThisTick.has(f.id))?.score ?? 0;
  const maxToday = topFreshScore >= 90 ? DAILY_CAP_URGENT : DAILY_CAP_NORMAL;

  if (totalToday >= maxToday) {
    if (totalScheduled > 0) {
      console.log(`[scheduleIgPost] daily cap reached after staples (${totalToday}/${maxToday})`);
      return { scheduled: totalScheduled, skipped: "", expired };
    }
    return { scheduled: 0, skipped: `daily-cap-reached (${totalToday}/${maxToday})`, expired };
  }

  let regularItem: typeof fresh[0] | undefined;

  // ── Type diversity: ensure news gets represented ─────────────────────
  const hasNewsToday = (todayTypeCounts.get("news") ?? 0) > 0;
  const nonNewsToday = todayStatuses.filter((i) => i.igType !== "news").length;
  const needsNewsDiversity = !hasNewsToday && (nonNewsToday >= 2 || totalToday >= 2);

  if (needsNewsDiversity) {
    const bestNewsCandidate = fresh.find(
      (q) =>
        q.igType === "news" &&
        !scheduledThisTick.has(q.id) &&
        matchesTargetPostDate(q, haitiToday),
    );
    if (bestNewsCandidate) {
      // Only force news diversity when the score gap is modest (≤25).
      // If a scholarship at 85 is waiting while the best news is 45,
      // forcing news causes high-value items to expire unposted.
      const bestNonNews = fresh.find(
        (q) =>
          q.igType !== "news" &&
          !scheduledThisTick.has(q.id) &&
          matchesTargetPostDate(q, haitiToday),
      );
      const gap = (bestNonNews?.score ?? 0) - (bestNewsCandidate.score ?? 0);
      if (gap <= 25) {
        regularItem = bestNewsCandidate;
        console.log(
          `[scheduleIgPost] type-diversity: picking news item ${regularItem.id} (score=${regularItem.score})`,
        );
      } else {
        console.log(
          `[scheduleIgPost] type-diversity: skipping news (score=${bestNewsCandidate.score}) — ` +
          `gap of ${gap} vs best non-news (score=${bestNonNews?.score}, type=${bestNonNews?.igType}) too large`,
        );
      }
    }
  }

  // ── Per-type cap enforcement ─────────────────────────────────────────
  // High-priority items (score ≥ 75) bypass type caps — genuinely urgent
  // content (deadline-imminent scholarships, breaking news) should never be
  // starved by caps while lower-scored items fill the remaining slots.
  // Threshold lowered from 85 to 75: scholarships base at 70 + deadline
  // urgency bonuses commonly land at 78-84 and were being blocked while
  // lower-scored news (45-55) filled the feed.
  if (!regularItem) {
    for (const candidate of fresh) {
      if (scheduledThisTick.has(candidate.id)) continue;
      if (!matchesTargetPostDate(candidate, haitiToday)) continue;
      const cap = TYPE_DAILY_CAPS[candidate.igType];
      const typeCount = todayTypeCounts.get(candidate.igType) ?? 0;
      if (cap != null && typeCount >= cap) {
        if ((candidate.score ?? 0) >= 75) {
          console.log(
            `[scheduleIgPost] high-score override: ${candidate.igType} item ${candidate.id} ` +
            `(score=${candidate.score}) bypasses type cap (${typeCount}/${cap})`,
          );
        } else {
          continue;
        }
      }
      regularItem = candidate;
      break;
    }
  }

  // Absolute fallback — pick the top-scoring item ignoring caps
  if (!regularItem) {
    regularItem = fresh.find(
      (f) => !scheduledThisTick.has(f.id) && matchesTargetPostDate(f, haitiToday),
    );
    if (regularItem) {
      console.log(
        `[scheduleIgPost] fallback: all types at cap, using top-score item ${regularItem.id} (type=${regularItem.igType})`,
      );
    }
  }

  if (regularItem) {
    const slot = getNextAvailableSlot(takenSlots);
    if (slot) {
      const slotISO = slot.toISOString();
      await igQueueRepo.setScheduled(regularItem.id, slotISO);
      takenSlots.add(slotISO);
      totalScheduled++;
      console.log(
        `[scheduleIgPost] regular: scheduled ${regularItem.igType} item ${regularItem.id} (score=${regularItem.score}) → ${slotISO}`,
      );
    } else {
      console.log(`[scheduleIgPost] no slot available for regular item`);
    }
  }

  return {
    scheduled: totalScheduled,
    skipped: totalScheduled > 0 ? "" : "no-available-slots",
    expired,
  };
}
