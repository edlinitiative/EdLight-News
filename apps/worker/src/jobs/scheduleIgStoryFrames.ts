/**
 * Worker job: scheduleIgStoryFrames (Cold-Start IG Stories)
 *
 * Fills three story slots per day during cold-start mode so that, combined
 * with the per-post echoes published inline by `processIgScheduled` (≈2/day)
 * and the existing daily summary recap (1/day), the account ships **5 story
 * frames/day** — the IG-algo sweet spot for Reach Accounts → Followers.
 *
 *                   ┌──────────────────────────────────────────────────┐
 *  Cold-start day → │  07:30  morning_echo   (per-post, inline)        │
 *                   │  12:00  midday_poll    ← THIS JOB (poll on taux) │
 *                   │  15:00  afternoon_quiz ← THIS JOB (quiz/fact)    │
 *                   │  18:30  evening_echo   (per-post, inline)        │
 *                   │  20:30  summary_recap  ← THIS JOB (delegates)    │
 *                   └──────────────────────────────────────────────────┘
 *
 * In **scale mode** (COLD_START_MODE != "true") this job is a no-op — the
 * pre-existing `buildIgStory` daily-summary path keeps running unchanged.
 *
 * Idempotency: each slot is gated by `igStoryQueueRepo.existsForSlot`, so
 * the job is safe to run on every tick (every 5 min). When the time window
 * for a slot opens (±15 min from the target time) we insert exactly one
 * queue item with `slot=<slot>` and `addToHighlight=true`. `processIgStory`
 * picks it up on the next tick and the highlight log fires after publish.
 *
 * Daily cap: `STORY_DAILY_CAP_COLD_START = 5`. The cap is enforced on the
 * union of all `ig_story_queue` rows for today (any status, any slot)
 * regardless of which job created them, so we never overshoot even if a
 * future job adds more slots.
 *
 * @module scheduleIgStoryFrames
 */

import { igStoryQueueRepo } from "@edlight-news/firebase";
import type { CreateIGStoryQueueItem, IGStoryPayload } from "@edlight-news/types";
import { isColdStartMode } from "../services/coldStart.js";
import {
  buildPollStoryFromTopic,
  type PollTopic,
} from "./buildPollStoryFromTopic.js";
import { buildIgStory } from "./buildIgStory.js";

// ── Constants ──────────────────────────────────────────────────────────────

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum story frames per day in cold-start mode. */
export const STORY_DAILY_CAP_COLD_START = 5;

/** ±N-minute window around each slot's target time. */
export const SLOT_WINDOW_MINUTES = 15;

/** Slot definitions in Haiti-local time. */
export interface ColdStartStorySlot {
  slot: "midday_poll" | "afternoon_quiz" | "summary_recap";
  hour: number;
  minute: number;
  /** Topic for poll-driven slots. `summary_recap` doesn't use this. */
  topic?: PollTopic;
}

export const COLD_START_STORY_SLOTS: readonly ColdStartStorySlot[] = [
  { slot: "midday_poll",    hour: 12, minute: 0,  topic: "taux" },
  { slot: "afternoon_quiz", hour: 15, minute: 0,  topic: "general" },
  { slot: "summary_recap",  hour: 20, minute: 30 },
];

// ── Result types ───────────────────────────────────────────────────────────

export interface ScheduleIgStoryFramesResult {
  scheduled: number;
  skipped: string[];
  capReached: boolean;
  coldStart: boolean;
}

// ── Time helpers ───────────────────────────────────────────────────────────

/**
 * Return Haiti-local hour/minute/dateKey for the given UTC instant.
 * Uses Intl parts to avoid the DST-ambiguous toLocaleString approach.
 */
export function haitiClockParts(now: Date = new Date()): {
  hour: number;
  minute: number;
  dateKey: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = parseInt(get("hour"), 10) % 24; // "24" → 0
  const minute = parseInt(get("minute"), 10);
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  return { hour, minute, dateKey };
}

/**
 * True iff `now` is within ±SLOT_WINDOW_MINUTES of the slot's target time.
 * Late ticks within window still fill the slot (so a missed 12:00 tick at
 * 12:13 still works).
 */
export function isWithinSlotWindow(
  slot: ColdStartStorySlot,
  haitiHour: number,
  haitiMinute: number,
): boolean {
  const slotMinutes = slot.hour * 60 + slot.minute;
  const nowMinutes = haitiHour * 60 + haitiMinute;
  return Math.abs(nowMinutes - slotMinutes) <= SLOT_WINDOW_MINUTES;
}

// ── Payload builders ──────────────────────────────────────────────────────

/**
 * Wrap a `buildPollStoryFromTopic` result in an IGStoryPayload (single
 * frame, 1080×1920) ready for the renderer.
 */
export function pollPayloadToStoryPayload(
  poll: ReturnType<typeof buildPollStoryFromTopic>,
): IGStoryPayload {
  return {
    slides: [
      {
        heading: poll.questionFr,
        bullets: poll.choices,
        eyebrow: poll.topic.toUpperCase(),
        footer: poll.dateKey,
        frameType: "headline",
      },
    ],
    dateLabel: poll.dateKey,
  };
}

// ── Dependency injection seam (for tests) ──────────────────────────────────

export const scheduleIgStoryFramesDeps = {
  countByDateKey: (dateKey: string) =>
    igStoryQueueRepo.countByDateKey(dateKey),
  existsForSlot: (
    dateKey: string,
    slot: NonNullable<CreateIGStoryQueueItem["slot"]>,
  ) => igStoryQueueRepo.existsForSlot(dateKey, slot),
  createStoryQueueItem: (data: CreateIGStoryQueueItem) =>
    igStoryQueueRepo.createStoryQueueItem(data),
  buildIgStory,
  buildPollStoryFromTopic,
  now: () => new Date(),
};

// ── Main job ───────────────────────────────────────────────────────────────

export async function scheduleIgStoryFrames(): Promise<ScheduleIgStoryFramesResult> {
  const result: ScheduleIgStoryFramesResult = {
    scheduled: 0,
    skipped: [],
    capReached: false,
    coldStart: isColdStartMode(),
  };

  if (!result.coldStart) {
    result.skipped.push("not-cold-start");
    return result;
  }

  const { hour, minute, dateKey } = haitiClockParts(
    scheduleIgStoryFramesDeps.now(),
  );

  // Hard daily cap across ALL story-queue rows for today.
  const todayCount = await scheduleIgStoryFramesDeps.countByDateKey(dateKey);
  if (todayCount >= STORY_DAILY_CAP_COLD_START) {
    result.capReached = true;
    result.skipped.push(`cap-reached:${todayCount}`);
    console.log(
      `[scheduleIgStoryFrames] ${JSON.stringify({
        event: "storyDailyCapReached",
        dateKey,
        count: todayCount,
        cap: STORY_DAILY_CAP_COLD_START,
      })}`,
    );
    return result;
  }

  for (const slot of COLD_START_STORY_SLOTS) {
    if (!isWithinSlotWindow(slot, hour, minute)) {
      result.skipped.push(`${slot.slot}:out-of-window`);
      continue;
    }

    const already = await scheduleIgStoryFramesDeps.existsForSlot(
      dateKey,
      slot.slot,
    );
    if (already) {
      result.skipped.push(`${slot.slot}:already-filled`);
      continue;
    }

    try {
      if (slot.slot === "summary_recap") {
        // Delegate to the existing summary builder. It already self-gates on
        // dateKey via getByDateKey, so calling it here is safe even when a
        // legacy summary doc (slot=undefined or slot="summary") exists.
        const summary = await scheduleIgStoryFramesDeps.buildIgStory();
        if (summary.queued) {
          result.scheduled++;
          console.log(
            `[scheduleIgStoryFrames] ${JSON.stringify({
              event: "storySlotFilled",
              dateKey,
              slot: slot.slot,
              source: "buildIgStory",
            })}`,
          );
        } else {
          result.skipped.push(`${slot.slot}:${summary.skipped}`);
        }
        continue;
      }

      // Poll-driven slots (midday_poll, afternoon_quiz)
      const topic = slot.topic ?? "general";
      const poll = scheduleIgStoryFramesDeps.buildPollStoryFromTopic(
        topic,
        dateKey,
      );
      const payload = pollPayloadToStoryPayload(poll);

      await scheduleIgStoryFramesDeps.createStoryQueueItem({
        dateKey,
        status: "queued",
        sourceItemIds: [],
        payload,
        slot: slot.slot,
        addToHighlight: true,
        storyFeatures: {
          pollQuestion: poll.questionFr.slice(0, 80),
          pollOptions: [poll.choices[0], poll.choices[1]],
        },
      } as CreateIGStoryQueueItem);

      result.scheduled++;
      console.log(
        `[scheduleIgStoryFrames] ${JSON.stringify({
          event: "storySlotFilled",
          dateKey,
          slot: slot.slot,
          topic,
          templateId: poll.templateId,
        })}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[scheduleIgStoryFrames] failed to fill slot ${slot.slot}: ${msg}`,
      );
      result.skipped.push(`${slot.slot}:error:${msg}`);
    }
  }

  return result;
}
