/**
 * Worker job: scheduleIgPost
 *
 * Runs hourly. Picks the highest-score queued item and schedules it
 * for the next available posting slot.
 *
 * Rules:
 * - Max 1 feed post/day (max 2 if score >= 90 and deadline <3d)
 * - Quiet hours: 23:00–07:00 Haiti time (UTC-5 / America/Port-au-Prince)
 * - Preferred slots: 12:30 or 19:00 local time
 */

import { igQueueRepo } from "@edlight-news/firebase";

// Haiti timezone
const HAITI_TZ = "America/Port-au-Prince";

export interface ScheduleIgPostResult {
  scheduled: number;
  skipped: string;
}

function toHaitiDate(date: Date): Date {
  // Convert UTC date to Haiti local time representation
  const haitiStr = date.toLocaleString("en-US", { timeZone: HAITI_TZ });
  return new Date(haitiStr);
}

function isQuietHour(date: Date): boolean {
  const haitiDate = toHaitiDate(date);
  const hour = haitiDate.getHours();
  return hour >= 23 || hour < 7;
}

function getNextSlot(): Date {
  const now = new Date();
  const haitiNow = toHaitiDate(now);
  const haitiHour = haitiNow.getHours();
  const haitiMinute = haitiNow.getMinutes();

  // Preferred slots: 12:30 and 19:00 Haiti time
  const slots = [
    { hour: 12, minute: 30 },
    { hour: 19, minute: 0 },
  ];

  // Find next available slot today or tomorrow
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const slot of slots) {
      const slotDate = new Date(haitiNow);
      slotDate.setDate(slotDate.getDate() + dayOffset);
      slotDate.setHours(slot.hour, slot.minute, 0, 0);

      // If today, must be in the future
      if (dayOffset === 0) {
        if (
          haitiHour > slot.hour ||
          (haitiHour === slot.hour && haitiMinute >= slot.minute)
        ) {
          continue;
        }
      }

      return slotDate;
    }
  }

  // Fallback: tomorrow 12:30
  const tomorrow = new Date(haitiNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 30, 0, 0);
  return tomorrow;
}

export async function scheduleIgPost(): Promise<ScheduleIgPostResult> {
  // Check quiet hours
  if (isQuietHour(new Date())) {
    return { scheduled: 0, skipped: "quiet-hours" };
  }

  // Check daily caps
  const postedToday = await igQueueRepo.countPostedToday();
  const scheduledToday = await igQueueRepo.countScheduledToday();
  const totalToday = postedToday + scheduledToday;

  // Get top queued item
  const queued = await igQueueRepo.listQueuedByScore(1);
  if (queued.length === 0) {
    return { scheduled: 0, skipped: "no-queued-items" };
  }

  const topItem = queued[0]!;

  // Cap enforcement
  const isUrgent = topItem.score >= 90;
  const maxToday = isUrgent ? 2 : 1;

  if (totalToday >= maxToday) {
    return { scheduled: 0, skipped: `daily-cap-reached (${totalToday}/${maxToday})` };
  }

  // Check if there's already a scheduled post for the next slot
  const scheduled = await igQueueRepo.listScheduled(5);
  const nextSlot = getNextSlot();
  const nextSlotISO = nextSlot.toISOString();

  // If there's already a post scheduled within 2 hours of the next slot, skip
  const hasConflict = scheduled.some((s) => {
    if (!s.scheduledFor) return false;
    const scheduledTime = new Date(s.scheduledFor).getTime();
    const slotTime = nextSlot.getTime();
    return Math.abs(scheduledTime - slotTime) < 2 * 60 * 60 * 1000;
  });

  if (hasConflict) {
    return { scheduled: 0, skipped: "slot-already-filled" };
  }

  // Schedule the post
  await igQueueRepo.setScheduled(topItem.id, nextSlotISO);
  console.log(`[scheduleIgPost] scheduled item ${topItem.id} (score=${topItem.score}, type=${topItem.igType}) for ${nextSlotISO}`);

  return { scheduled: 1, skipped: "" };
}
