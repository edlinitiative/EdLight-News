/**
 * Worker job: scheduleIgPost
 *
 * Runs on every tick. Picks the highest-score queued item and schedules it
 * for the next available posting slot.
 *
 * Rules:
 * - Max 5 feed posts/day (up to 7 if score >= 90 urgent content)
 * - Quiet hours: 23:00–07:00 Haiti time (UTC-5 / America/Port-au-Prince)
 * - Preferred slots spread across the day for best engagement
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

  // 7 slots spread across the day for 3-7 posts
  const slots = [
    { hour: 8, minute: 0 },    // Morning — early scrollers
    { hour: 10, minute: 30 },   // Mid-morning
    { hour: 12, minute: 30 },   // Lunch break
    { hour: 15, minute: 0 },    // Afternoon
    { hour: 17, minute: 30 },   // After school/work
    { hour: 19, minute: 0 },    // Evening prime time
    { hour: 21, minute: 0 },    // Late evening
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

  // Fallback: tomorrow 08:00
  const tomorrow = new Date(haitiNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
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

  // Cap enforcement: 5 normal, 7 for urgent (score >= 90)
  const isUrgent = topItem.score >= 90;
  const maxToday = isUrgent ? 7 : 5;

  if (totalToday >= maxToday) {
    return { scheduled: 0, skipped: `daily-cap-reached (${totalToday}/${maxToday})` };
  }

  // Check if there's already a scheduled post for the next slot
  const scheduled = await igQueueRepo.listScheduled(10);
  const nextSlot = getNextSlot();
  const nextSlotISO = nextSlot.toISOString();

  // If there's already a post scheduled within 1 hour of the next slot, skip
  const hasConflict = scheduled.some((s) => {
    if (!s.scheduledFor) return false;
    const scheduledTime = new Date(s.scheduledFor).getTime();
    const slotTime = nextSlot.getTime();
    return Math.abs(scheduledTime - slotTime) < 1 * 60 * 60 * 1000;
  });

  if (hasConflict) {
    return { scheduled: 0, skipped: "slot-already-filled" };
  }

  // Schedule the post
  await igQueueRepo.setScheduled(topItem.id, nextSlotISO);
  console.log(`[scheduleIgPost] scheduled item ${topItem.id} (score=${topItem.score}, type=${topItem.igType}) for ${nextSlotISO}`);

  return { scheduled: 1, skipped: "" };
}
