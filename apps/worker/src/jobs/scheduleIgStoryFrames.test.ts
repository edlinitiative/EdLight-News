/**
 * scheduleIgStoryFrames — cold-start IG Story scheduler tests.
 *
 * Covers:
 *   • haitiClockParts conversion (UTC → Haiti)
 *   • isWithinSlotWindow ±15 min logic
 *   • pollPayloadToStoryPayload shape contract
 *   • scheduler skips when COLD_START_MODE is off
 *   • daily cap (5) enforcement
 *   • per-slot idempotency via existsForSlot
 *   • happy path: fills midday_poll, afternoon_quiz, summary_recap
 *   • addToHighlight=true on every cold-start row
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  scheduleIgStoryFrames,
  scheduleIgStoryFramesDeps,
  COLD_START_STORY_SLOTS,
  STORY_DAILY_CAP_COLD_START,
  SLOT_WINDOW_MINUTES,
  haitiClockParts,
  isWithinSlotWindow,
  pollPayloadToStoryPayload,
} from "./scheduleIgStoryFrames.js";
import { _resetColdStartBootLogForTest } from "../services/coldStart.js";
import type { CreateIGStoryQueueItem } from "@edlight-news/types";

const ORIGINAL_COLD_START = process.env.COLD_START_MODE;

// ── Test harness ──────────────────────────────────────────────────────────

interface Fake {
  createdRows: CreateIGStoryQueueItem[];
  existing: Set<string>; // slot strings already filled
  count: number;
  buildIgStoryCalled: boolean;
  buildIgStoryReturn: { queued: boolean; skipped: string };
}

function installFakes(now: Date, init: Partial<Fake> = {}): Fake {
  const fake: Fake = {
    createdRows: [],
    existing: new Set(init.existing ?? []),
    count: init.count ?? 0,
    buildIgStoryCalled: false,
    buildIgStoryReturn: init.buildIgStoryReturn ?? { queued: true, skipped: "" },
  };

  scheduleIgStoryFramesDeps.now = () => now;
  scheduleIgStoryFramesDeps.countByDateKey = async () => fake.count;
  scheduleIgStoryFramesDeps.existsForSlot = async (_dateKey, slot) =>
    fake.existing.has(slot);
  scheduleIgStoryFramesDeps.createStoryQueueItem = async (data) => {
    fake.createdRows.push(data);
    return { id: "fake-" + fake.createdRows.length, ...data } as any;
  };
  scheduleIgStoryFramesDeps.buildIgStory = async () => {
    fake.buildIgStoryCalled = true;
    return fake.buildIgStoryReturn;
  };

  return fake;
}

/** Build a UTC Date that lands at `hh:mm` Haiti-local. Haiti observes DST
 *  (UTC-4 in summer, UTC-5 in winter) so we round-trip via Intl rather
 *  than hard-coding an offset. */
function haitiTimeUTC(year: number, month: number, day: number, h: number, m: number): Date {
  // Start with a guess at UTC-5, then iterate to align Haiti-local hour/min.
  let guess = new Date(Date.UTC(year, month - 1, day, h + 5, m, 0));
  for (let i = 0; i < 3; i++) {
    const parts = haitiClockParts(guess);
    if (parts.hour === h && parts.minute === m) return guess;
    const dh = h - parts.hour;
    const dm = m - parts.minute;
    guess = new Date(guess.getTime() + (dh * 60 + dm) * 60_000);
  }
  return guess;
}

beforeEach(() => {
  delete process.env.COLD_START_MODE;
  _resetColdStartBootLogForTest();
});

afterEach(() => {
  if (ORIGINAL_COLD_START === undefined) {
    delete process.env.COLD_START_MODE;
  } else {
    process.env.COLD_START_MODE = ORIGINAL_COLD_START;
  }
  _resetColdStartBootLogForTest();
});

// ── Pure helpers ──────────────────────────────────────────────────────────

describe("haitiClockParts", () => {
  it("converts a UTC instant to Haiti-local hour/minute/dateKey (winter, UTC-5)", () => {
    // January 14, 2026 — winter, no DST → Haiti = UTC-5
    const utc = new Date(Date.UTC(2026, 0, 14, 17, 7, 0)); // 17:07 UTC = 12:07 Haiti
    const parts = haitiClockParts(utc);
    assert.equal(parts.hour, 12);
    assert.equal(parts.minute, 7);
    assert.equal(parts.dateKey, "2026-01-14");
  });

  it("respects DST (summer, UTC-4)", () => {
    // May 14, 2026 — DST is active → Haiti = UTC-4
    const utc = new Date(Date.UTC(2026, 4, 14, 16, 0, 0)); // 16:00 UTC = 12:00 Haiti
    const parts = haitiClockParts(utc);
    assert.equal(parts.hour, 12);
    assert.equal(parts.dateKey, "2026-05-14");
  });

  it("handles late-night UTC that lands on previous Haiti day", () => {
    // 03:00 UTC on Jan 15 = 22:00 Haiti on Jan 14 (winter, UTC-5)
    const utc = new Date(Date.UTC(2026, 0, 15, 3, 0, 0));
    const parts = haitiClockParts(utc);
    assert.equal(parts.hour, 22);
    assert.equal(parts.dateKey, "2026-01-14");
  });
});

describe("isWithinSlotWindow", () => {
  const slot = COLD_START_STORY_SLOTS.find((s) => s.slot === "midday_poll")!;
  it("true at exact slot time", () => {
    assert.equal(isWithinSlotWindow(slot, 12, 0), true);
  });
  it("true within +SLOT_WINDOW_MINUTES", () => {
    assert.equal(isWithinSlotWindow(slot, 12, SLOT_WINDOW_MINUTES), true);
  });
  it("true within -SLOT_WINDOW_MINUTES", () => {
    assert.equal(isWithinSlotWindow(slot, 11, 60 - SLOT_WINDOW_MINUTES), true);
  });
  it("false outside the window", () => {
    assert.equal(isWithinSlotWindow(slot, 12, SLOT_WINDOW_MINUTES + 1), false);
    assert.equal(isWithinSlotWindow(slot, 13, 0), false);
  });
});

describe("pollPayloadToStoryPayload", () => {
  it("wraps a poll into a 1-slide IGStoryPayload with poll fields", () => {
    const poll = {
      topic: "taux" as const,
      dateKey: "2026-05-14",
      templateId: "taux.foo",
      questionFr: "La gourde a-t-elle gagné ou perdu aujourd'hui ?",
      questionHt: "Goud la genyen oswa pèdi jodi a ?",
      choices: ["Gagné", "Perdu"] as [string, string],
    };
    const payload = pollPayloadToStoryPayload(poll);
    assert.equal(payload.slides.length, 1);
    assert.equal(payload.slides[0]!.heading, poll.questionFr);
    assert.deepEqual(payload.slides[0]!.bullets, ["Gagné", "Perdu"]);
    assert.equal(payload.slides[0]!.frameType, "headline");
    assert.equal(payload.dateLabel, "2026-05-14");
  });
});

// ── Behaviour ─────────────────────────────────────────────────────────────

describe("scheduleIgStoryFrames — gating", () => {
  it("no-ops when COLD_START_MODE is off", async () => {
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 12, 0));
    const result = await scheduleIgStoryFrames();
    assert.equal(result.coldStart, false);
    assert.equal(result.scheduled, 0);
    assert.deepEqual(result.skipped, ["not-cold-start"]);
    assert.equal(fake.createdRows.length, 0);
  });

  it("respects daily cap of 5", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 12, 0), {
      count: STORY_DAILY_CAP_COLD_START,
    });
    const result = await scheduleIgStoryFrames();
    assert.equal(result.capReached, true);
    assert.equal(result.scheduled, 0);
    assert.equal(fake.createdRows.length, 0);
  });

  it("STORY_DAILY_CAP_COLD_START is exactly 5", () => {
    assert.equal(STORY_DAILY_CAP_COLD_START, 5);
  });
});

describe("scheduleIgStoryFrames — slot filling", () => {
  it("fills midday_poll at 12:00 Haiti", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 12, 0));
    const result = await scheduleIgStoryFrames();
    assert.equal(result.scheduled, 1, `skipped=${JSON.stringify(result.skipped)}`);
    assert.equal(fake.createdRows.length, 1);
    const row = fake.createdRows[0]!;
    assert.equal(row.slot, "midday_poll");
    assert.equal(row.addToHighlight, true);
    assert.equal(row.status, "queued");
    assert.equal(row.dateKey, "2026-05-14");
    assert.ok(row.payload?.slides[0]?.heading.length! > 0);
    assert.ok(row.storyFeatures?.pollOptions?.length === 2);
  });

  it("fills afternoon_quiz at 15:00 Haiti", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 15, 0));
    const result = await scheduleIgStoryFrames();
    assert.equal(result.scheduled, 1);
    assert.equal(fake.createdRows[0]!.slot, "afternoon_quiz");
  });

  it("delegates summary_recap to buildIgStory at 20:30 Haiti", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 20, 30));
    const result = await scheduleIgStoryFrames();
    assert.equal(fake.buildIgStoryCalled, true);
    assert.equal(result.scheduled, 1);
    // buildIgStory writes its own row (not via the fake create), so
    // createdRows stays empty for this slot.
    assert.equal(fake.createdRows.length, 0);
  });

  it("skips a slot already filled today (idempotent)", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 12, 5), {
      existing: new Set(["midday_poll"]),
    });
    const result = await scheduleIgStoryFrames();
    assert.equal(result.scheduled, 0);
    assert.ok(result.skipped.some((s) => s.startsWith("midday_poll:already-filled")));
    assert.equal(fake.createdRows.length, 0);
  });

  it("does nothing outside any slot window (e.g. 09:00)", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 9, 0));
    const result = await scheduleIgStoryFrames();
    assert.equal(result.scheduled, 0);
    assert.equal(fake.createdRows.length, 0);
    // Every slot reports out-of-window
    assert.equal(
      result.skipped.filter((s) => s.endsWith(":out-of-window")).length,
      COLD_START_STORY_SLOTS.length,
    );
  });

  it("late-but-in-window tick (12:13) still fills midday_poll", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 12, 13));
    const result = await scheduleIgStoryFrames();
    assert.equal(result.scheduled, 1);
    assert.equal(fake.createdRows[0]!.slot, "midday_poll");
  });

  it("propagates buildIgStory skip reason", async () => {
    process.env.COLD_START_MODE = "true";
    const fake = installFakes(haitiTimeUTC(2026, 5, 14, 20, 30), {
      buildIgStoryReturn: { queued: false, skipped: "already-exists" },
    });
    const result = await scheduleIgStoryFrames();
    assert.equal(result.scheduled, 0);
    assert.ok(
      result.skipped.some((s) => s === "summary_recap:already-exists"),
      `expected summary_recap:already-exists in ${JSON.stringify(result.skipped)}`,
    );
  });
});

describe("scheduleIgStoryFrames — calendar/cadence contract", () => {
  it("declares exactly 3 cold-start slots", () => {
    assert.equal(COLD_START_STORY_SLOTS.length, 3);
    assert.deepEqual(
      COLD_START_STORY_SLOTS.map((s) => s.slot),
      ["midday_poll", "afternoon_quiz", "summary_recap"],
    );
  });

  it("midday_poll uses the taux topic", () => {
    const s = COLD_START_STORY_SLOTS.find((x) => x.slot === "midday_poll")!;
    assert.equal(s.topic, "taux");
    assert.equal(s.hour, 12);
    assert.equal(s.minute, 0);
  });

  it("afternoon_quiz uses the general topic", () => {
    const s = COLD_START_STORY_SLOTS.find((x) => x.slot === "afternoon_quiz")!;
    assert.equal(s.topic, "general");
    assert.equal(s.hour, 15);
  });

  it("summary_recap is at 20:30 with no topic (delegates)", () => {
    const s = COLD_START_STORY_SLOTS.find((x) => x.slot === "summary_recap")!;
    assert.equal(s.hour, 20);
    assert.equal(s.minute, 30);
    assert.equal(s.topic, undefined);
  });
});
