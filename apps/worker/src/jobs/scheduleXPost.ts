/**
 * Worker job: scheduleXPost
 *
 * Runs on every tick. Takes queued X (Twitter) items and assigns them
 * to posting slots spread across the day.
 *
 * Modeled on scheduleWaPost — same slot-based scheduling pattern.
 */

import { xQueueRepo } from "@edlight-news/firebase";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum X posts per day. */
const DAILY_CAP = 10;

/** X posting slots (Haiti local time). */
const SLOTS = [
  { hour: 6, minute: 0 },
  { hour: 7, minute: 30 },
  { hour: 9, minute: 0 },
  { hour: 10, minute: 30 },
  { hour: 12, minute: 0 },
  { hour: 13, minute: 30 },
  { hour: 15, minute: 30 },
  { hour: 17, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 21, minute: 0 },
];

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

export interface ScheduleXPostResult {
  scheduled: number;
  skippedCap: number;
}

export async function scheduleXPost(): Promise<ScheduleXPostResult> {
  const result: ScheduleXPostResult = { scheduled: 0, skippedCap: 0 };

  try {
    const sentToday = await xQueueRepo.countSentToday();
    const scheduledToday = await xQueueRepo.countScheduledToday();
    const totalToday = sentToday + scheduledToday;

    if (totalToday >= DAILY_CAP) {
      console.log(`[scheduleXPost] Daily cap reached (${totalToday}/${DAILY_CAP})`);
      return result;
    }

    const remaining = DAILY_CAP - totalToday;

    const queued = await xQueueRepo.listQueuedByScore(remaining);
    if (queued.length === 0) {
      console.log("[scheduleXPost] No queued X items");
      return result;
    }

    const scheduled = await xQueueRepo.listScheduled(50);
    const takenSlotISOs = new Set<string>();
    for (const item of scheduled) {
      if (item.scheduledFor) takenSlotISOs.add(item.scheduledFor);
    }

    for (const item of queued) {
      if (result.scheduled >= remaining) {
        result.skippedCap++;
        continue;
      }

      const slot = getNextAvailableSlot(takenSlotISOs);
      if (!slot) {
        console.log("[scheduleXPost] No available slots");
        break;
      }

      const iso = slot.toISOString();
      await xQueueRepo.setScheduled(item.id, iso);
      takenSlotISOs.add(iso);
      result.scheduled++;
      console.log(`[scheduleXPost] Scheduled ${item.id} → ${iso}`);
    }

    console.log("[scheduleXPost] Done:", result);
    return result;
  } catch (err) {
    console.error("[scheduleXPost] Error:", err);
    return result;
  }
}
