/**
 * Worker job: scheduleThPost
 *
 * Runs on every tick. Takes queued Threads items and assigns them to
 * posting slots spread across the day.
 *
 * Modeled on scheduleWaPost — same slot-based scheduling pattern.
 */

import { thQueueRepo } from "@edlight-news/firebase";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum Threads posts per day. Raised from 6 → 12 (P1.2). */
const DAILY_CAP = 12;

/**
 * Threads posting slots (Haiti local time).
 * Cadence raised from 6 → 12 slots per day so we capture more of the
 * Threads algorithm's volume reward. Slots avoid the 23:00–05:30 quiet
 * window enforced below.
 */
const SLOTS = [
  { hour: 7, minute: 30 },
  { hour: 9, minute: 0 },
  { hour: 10, minute: 30 },
  { hour: 12, minute: 0 },
  { hour: 13, minute: 30 },
  { hour: 15, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 18, minute: 30 },
  { hour: 20, minute: 0 },
  { hour: 21, minute: 0 },
  { hour: 22, minute: 0 },
];

/**
 * Quiet hours window (Haiti local time) — no scheduling between 23:00 and 05:30.
 * Mirrors IG quiet hours so we don't post overnight.
 */
const QUIET_HOURS_START = { hour: 23, minute: 0 };
const QUIET_HOURS_END = { hour: 5, minute: 30 };

function isInQuietHours(hour: number, minute: number): boolean {
  const m = hour * 60 + minute;
  const start = QUIET_HOURS_START.hour * 60 + QUIET_HOURS_START.minute;
  const end = QUIET_HOURS_END.hour * 60 + QUIET_HOURS_END.minute;
  // Quiet window wraps midnight: [23:00, 24:00) ∪ [00:00, 05:30)
  return m >= start || m < end;
}

/** Exported for unit tests (P1.2). */
export function _isInQuietHoursForTest(hour: number, minute: number): boolean {
  return isInQuietHours(hour, minute);
}

/** Exported for unit tests (P1.2). */
export const _SLOTS_FOR_TEST = SLOTS;
export const _DAILY_CAP_FOR_TEST = DAILY_CAP;

function toHaitiDate(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`);
}

function getHaitiOffsetHours(date: Date = new Date()): number {
  const haitiHour = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: HAITI_TZ, hour: "2-digit", hour12: false }).format(date),
    10,
  );
  const utcHour = date.getUTCHours();
  let diff = utcHour - haitiHour;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff;
}

function getNextAvailableSlot(takenSlotISOs: Set<string>): Date | null {
  const now = new Date();
  const haitiNow = toHaitiDate(now);
  const haitiHour = haitiNow.getUTCHours();
  const haitiMinute = haitiNow.getUTCMinutes();
  const offsetHours = getHaitiOffsetHours(now);

  const haitiYear = haitiNow.getUTCFullYear();
  const haitiMonth = haitiNow.getUTCMonth();
  const haitiDay = haitiNow.getUTCDate();

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const slot of SLOTS) {
      // Skip slots inside the quiet window (defense in depth).
      if (isInQuietHours(slot.hour, slot.minute)) continue;
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

      if (takenSlotISOs.has(iso)) continue;

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

  return null;
}

/** Maximum scholarship posts per day across all types. */
const SCHOLARSHIP_DAILY_CAP = 3;

export interface ScheduleThPostResult {
  scheduled: number;
  skippedCap: number;
}

export async function scheduleThPost(): Promise<ScheduleThPostResult> {
  const result: ScheduleThPostResult = { scheduled: 0, skippedCap: 0 };

  try {
    const sentToday = await thQueueRepo.countSentToday();
    const scheduledToday = await thQueueRepo.countScheduledToday();
    const totalToday = sentToday + scheduledToday;

    if (totalToday >= DAILY_CAP) {
      console.log(`[scheduleThPost] Daily cap reached (${totalToday}/${DAILY_CAP})`);
      return result;
    }

    const remaining = DAILY_CAP - totalToday;

    const queued = await thQueueRepo.listQueuedByScore(remaining);
    if (queued.length === 0) {
      console.log("[scheduleThPost] No queued Threads items");
      return result;
    }

    const scheduled = await thQueueRepo.listScheduled(50);
    const takenSlotISOs = new Set<string>();
    for (const item of scheduled) {
      if (item.scheduledFor) takenSlotISOs.add(item.scheduledFor);
    }

    const sentTodayItems = await thQueueRepo.listSentToday(20);
    let scholarshipsToday =
      sentTodayItems.filter((i) => i.igType === "scholarship").length +
      scheduled.filter((i) => i.igType === "scholarship").length;

    for (const item of queued) {
      if (result.scheduled >= remaining) {
        result.skippedCap++;
        continue;
      }

      if (item.igType === "scholarship" && scholarshipsToday >= SCHOLARSHIP_DAILY_CAP) {
        result.skippedCap++;
        console.log(`[scheduleThPost] Scholarship daily cap reached (${scholarshipsToday}/${SCHOLARSHIP_DAILY_CAP}), skipping ${item.id}`);
        continue;
      }

      const slot = getNextAvailableSlot(takenSlotISOs);
      if (!slot) {
        console.log("[scheduleThPost] No available slots");
        break;
      }

      const iso = slot.toISOString();
      await thQueueRepo.setScheduled(item.id, iso);
      takenSlotISOs.add(iso);
      if (item.igType === "scholarship") scholarshipsToday++;
      result.scheduled++;
      console.log(`[scheduleThPost] Scheduled ${item.id} → ${iso}`);
    }

    console.log("[scheduleThPost] Done:", result);
    return result;
  } catch (err) {
    console.error("[scheduleThPost] Error:", err);
    return result;
  }
}
