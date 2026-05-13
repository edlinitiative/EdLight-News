/**
 * P1.2 — Threads scheduler tests.
 *
 * Verifies the cadence + quiet-hours invariants:
 *   • DAILY_CAP raised to 12.
 *   • SLOTS contains 12 entries.
 *   • No slot falls inside the 23:00–05:30 quiet window.
 *   • isInQuietHours wraps midnight correctly.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  _SLOTS_FOR_TEST,
  _DAILY_CAP_FOR_TEST,
  _isInQuietHoursForTest,
} from "./scheduleThPost.js";

describe("scheduleThPost cadence (P1.2)", () => {
  it("daily cap is 12", () => {
    assert.equal(_DAILY_CAP_FOR_TEST, 12);
  });

  it("has 12 distinct slots", () => {
    assert.equal(_SLOTS_FOR_TEST.length, 12);
    const keys = _SLOTS_FOR_TEST.map((s) => `${s.hour}:${s.minute}`);
    assert.equal(new Set(keys).size, 12);
  });

  it("no slot falls inside the quiet window", () => {
    for (const slot of _SLOTS_FOR_TEST) {
      assert.equal(
        _isInQuietHoursForTest(slot.hour, slot.minute),
        false,
        `slot ${slot.hour}:${slot.minute} unexpectedly in quiet hours`,
      );
    }
  });

  it("quiet-hours wraps midnight: 23:00 and 04:00 are quiet, 06:00 and 22:00 are not", () => {
    assert.equal(_isInQuietHoursForTest(23, 0), true);
    assert.equal(_isInQuietHoursForTest(23, 59), true);
    assert.equal(_isInQuietHoursForTest(0, 0), true);
    assert.equal(_isInQuietHoursForTest(4, 0), true);
    assert.equal(_isInQuietHoursForTest(5, 29), true);
    assert.equal(_isInQuietHoursForTest(5, 30), false);
    assert.equal(_isInQuietHoursForTest(6, 0), false);
    assert.equal(_isInQuietHoursForTest(22, 59), false);
  });

  it("slots are pairwise spaced by ≥ 30 minutes (avoids adjacency rejection)", () => {
    const ascending = [..._SLOTS_FOR_TEST].sort(
      (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
    );
    for (let i = 1; i < ascending.length; i++) {
      const a = ascending[i - 1]!;
      const b = ascending[i]!;
      const gap = b.hour * 60 + b.minute - (a.hour * 60 + a.minute);
      assert.ok(gap >= 30, `slot pair ${a.hour}:${a.minute} → ${b.hour}:${b.minute} has gap ${gap}min`);
    }
  });
});
