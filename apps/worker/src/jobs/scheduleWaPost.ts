/**
 * Worker job: scheduleWaPost
 *
 * Runs on every tick. Takes queued WA items and assigns them to
 * sending slots spread across the day.
 *
 * Much simpler than IG scheduling:
 *  - No daily staple types (histoire, taux are IG-only)
 *  - Fewer slots per day (max 5 WA messages/day vs 10 IG posts)
 *  - No rendering step — goes straight from scheduled → sending → sent
 */

import { waQueueRepo } from "@edlight-news/firebase";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum WA messages per day. */
const DAILY_CAP = 5;

/** WA sending slots (Haiti local time).
 *  Spread across the day for best engagement without being spammy. */
const SLOTS = [
  { hour: 7, minute: 0 },     // Morning
  { hour: 10, minute: 0 },    // Mid-morning
  { hour: 13, minute: 0 },    // Afternoon
  { hour: 16, minute: 30 },   // After school
  { hour: 19, minute: 0 },    // Evening
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

      // Safety: skip if within 30 min of any taken slot
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

export interface ScheduleWaPostResult {
  scheduled: number;
  skippedCap: number;
}

export async function scheduleWaPost(): Promise<ScheduleWaPostResult> {
  const result: ScheduleWaPostResult = { scheduled: 0, skippedCap: 0 };

  try {
    // Check daily cap
    const sentToday = await waQueueRepo.countSentToday();
    const scheduledToday = await waQueueRepo.countScheduledToday();
    const totalToday = sentToday + scheduledToday;

    if (totalToday >= DAILY_CAP) {
      console.log(`[scheduleWaPost] Daily cap reached (${totalToday}/${DAILY_CAP})`);
      return result;
    }

    const remaining = DAILY_CAP - totalToday;

    // Get queued items (highest score first)
    const queued = await waQueueRepo.listQueuedByScore(remaining);
    if (queued.length === 0) {
      console.log("[scheduleWaPost] No queued WA items");
      return result;
    }

    // Collect already-taken slots
    const scheduled = await waQueueRepo.listScheduled(50);
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
        console.log("[scheduleWaPost] No available slots");
        break;
      }

      const iso = slot.toISOString();
      await waQueueRepo.setScheduled(item.id, iso);
      takenSlotISOs.add(iso);
      result.scheduled++;
      console.log(`[scheduleWaPost] Scheduled ${item.id} → ${iso}`);
    }

    console.log("[scheduleWaPost] Done:", result);
    return result;
  } catch (err) {
    console.error("[scheduleWaPost] Error:", err);
    return result;
  }
}
