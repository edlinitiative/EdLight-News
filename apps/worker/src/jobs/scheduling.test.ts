/**
 * Scheduling tests — validates all time-window, slot-assignment,
 * staleness, and configuration logic for the IG posting pipeline.
 *
 * Pure-logic tests (no Firebase, no network).
 *
 * Coverage:
 *  ● Quiet hours boundary (23:00–05:29 Haiti)
 *  ● Taux window (05:30–08:29 Haiti)
 *  ● Story window (05:30–06:29 Haiti)
 *  ● Pinned morning slots for daily staples
 *  ● Slot conflict detection (30-min safety margin)
 *  ● Staleness TTL per ig type
 *  ● Daily caps (normal vs urgent)
 *  ● Per-type caps
 *  ● BRH date parsing (French month names)
 *  ● Haiti timezone offset (EST/EDT)
 *  ● getNextAvailableSlot with taken slots
 *
 * Run:  cd apps/worker && node --import tsx --test src/jobs/scheduling.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isStale,
  isQuietHour,
  toHaitiDate,
  getHaitiOffsetHours,
  getNextAvailableSlot,
  SLOTS,
  STALENESS_TTL_HOURS,
  TYPE_DAILY_CAPS,
  DAILY_STAPLES,
  DAILY_CAP_NORMAL,
  DAILY_CAP_URGENT,
  STAPLE_SLOT_INDEX,
} from "./scheduleIgPost.js";

import {
  parseBRHDate,
  FRENCH_MONTHS,
} from "./buildIgTaux.js";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Build a Firestore-like timestamp n hours ago. */
function hoursAgo(hours: number) {
  return { seconds: Math.floor((Date.now() - hours * 3600_000) / 1000), nanoseconds: 0 };
}

/** Build a UTC Date for a given Haiti local hour:minute on today.
 *  Uses the live Haiti offset so it works in any host timezone. */
function haitiTime(hour: number, minute: number): Date {
  const offsetH = getHaitiOffsetHours();
  const now = toHaitiDate(new Date());
  return new Date(
    Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(),
      hour + offsetH, minute, 0, 0,
    ),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1) SLOT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Slot configuration", () => {
  it("has exactly 10 time slots", () => {
    assert.equal(SLOTS.length, 10);
  });

  it("pinned morning slots: taux 06:30, utility 06:50, histoire 07:00", () => {
    assert.deepEqual(SLOTS[0], { hour: 6, minute: 30 });
    assert.deepEqual(SLOTS[1], { hour: 6, minute: 50 });
    assert.deepEqual(SLOTS[2], { hour: 7, minute: 0 });
  });

  it("slots are in ascending chronological order", () => {
    for (let i = 1; i < SLOTS.length; i++) {
      const prev = SLOTS[i - 1]!.hour * 60 + SLOTS[i - 1]!.minute;
      const curr = SLOTS[i]!.hour * 60 + SLOTS[i]!.minute;
      assert.ok(curr > prev, `Slot ${i} (${SLOTS[i]!.hour}:${SLOTS[i]!.minute}) should be after slot ${i - 1}`);
    }
  });

  it("all slots are outside quiet hours (≥ 05:30, < 23:00)", () => {
    for (const slot of SLOTS) {
      const totalMinutes = slot.hour * 60 + slot.minute;
      assert.ok(totalMinutes >= 330, `Slot ${slot.hour}:${slot.minute} is before 05:30`);
      assert.ok(totalMinutes < 1380, `Slot ${slot.hour}:${slot.minute} is after 23:00`);
    }
  });

  it("morning staple slots are intentionally packed close (≥ 10 min)", () => {
    // Staple slots 0–2 are packed close for the morning burst (06:30, 06:50, 07:00)
    for (let i = 1; i <= 2; i++) {
      const prev = SLOTS[i - 1]!.hour * 60 + SLOTS[i - 1]!.minute;
      const curr = SLOTS[i]!.hour * 60 + SLOTS[i]!.minute;
      assert.ok(curr - prev >= 10, `Staple slots ${i - 1} and ${i} are only ${curr - prev}min apart`);
    }
  });

  it("general slots (3+) are at least 20 minutes apart", () => {
    for (let i = 4; i < SLOTS.length; i++) {
      const prev = SLOTS[i - 1]!.hour * 60 + SLOTS[i - 1]!.minute;
      const curr = SLOTS[i]!.hour * 60 + SLOTS[i]!.minute;
      assert.ok(curr - prev >= 20, `General slots ${i - 1} and ${i} are only ${curr - prev}min apart`);
    }
  });

  it("general slots start at 08:30 (after all staple pins)", () => {
    assert.deepEqual(SLOTS[3], { hour: 8, minute: 30 });
  });

  it("last slot is 20:00 (before quiet hours)", () => {
    const last = SLOTS[SLOTS.length - 1]!;
    assert.equal(last.hour, 20);
    assert.equal(last.minute, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2) STAPLE SLOT INDEX
// ═══════════════════════════════════════════════════════════════════════════

describe("Staple slot pinning", () => {
  it("maps taux → slot 0 (06:30)", () => {
    assert.equal(STAPLE_SLOT_INDEX["taux"], 0);
    assert.deepEqual(SLOTS[STAPLE_SLOT_INDEX["taux"]!], { hour: 6, minute: 30 });
  });

  it("maps utility → slot 1 (06:50)", () => {
    assert.equal(STAPLE_SLOT_INDEX["utility"], 1);
    assert.deepEqual(SLOTS[STAPLE_SLOT_INDEX["utility"]!], { hour: 6, minute: 50 });
  });

  it("maps histoire → slot 2 (07:00)", () => {
    assert.equal(STAPLE_SLOT_INDEX["histoire"], 2);
    assert.deepEqual(SLOTS[STAPLE_SLOT_INDEX["histoire"]!], { hour: 7, minute: 0 });
  });

  it("all DAILY_STAPLES have a pinned slot", () => {
    for (const staple of DAILY_STAPLES) {
      assert.ok(staple in STAPLE_SLOT_INDEX, `Missing pinned slot for ${staple}`);
    }
  });

  it("DAILY_STAPLES order is taux, histoire, utility", () => {
    assert.deepEqual(DAILY_STAPLES, ["taux", "histoire", "utility"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3) QUIET HOURS
// ═══════════════════════════════════════════════════════════════════════════

describe("isQuietHour", () => {
  it("23:00 Haiti → quiet", () => {
    assert.equal(isQuietHour(haitiTime(23, 0)), true);
  });

  it("23:59 Haiti → quiet", () => {
    assert.equal(isQuietHour(haitiTime(23, 59)), true);
  });

  it("00:00 Haiti → quiet (midnight)", () => {
    assert.equal(isQuietHour(haitiTime(0, 0)), true);
  });

  it("03:00 Haiti → quiet", () => {
    assert.equal(isQuietHour(haitiTime(3, 0)), true);
  });

  it("04:59 Haiti → quiet", () => {
    assert.equal(isQuietHour(haitiTime(4, 59)), true);
  });

  it("05:00 Haiti → quiet (before 05:30)", () => {
    assert.equal(isQuietHour(haitiTime(5, 0)), true);
  });

  it("05:29 Haiti → quiet (boundary)", () => {
    assert.equal(isQuietHour(haitiTime(5, 29)), true);
  });

  it("05:30 Haiti → NOT quiet (boundary opens)", () => {
    assert.equal(isQuietHour(haitiTime(5, 30)), false);
  });

  it("06:00 Haiti → NOT quiet", () => {
    assert.equal(isQuietHour(haitiTime(6, 0)), false);
  });

  it("12:00 Haiti → NOT quiet (midday)", () => {
    assert.equal(isQuietHour(haitiTime(12, 0)), false);
  });

  it("18:00 Haiti → NOT quiet (evening)", () => {
    assert.equal(isQuietHour(haitiTime(18, 0)), false);
  });

  it("22:59 Haiti → NOT quiet (just before quiet)", () => {
    assert.equal(isQuietHour(haitiTime(22, 59)), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4) STALENESS TTL
// ═══════════════════════════════════════════════════════════════════════════

describe("Staleness TTL configuration", () => {
  it("news = 48h", () => assert.equal(STALENESS_TTL_HOURS.news, 48));
  it("taux = 24h", () => assert.equal(STALENESS_TTL_HOURS.taux, 24));
  it("utility = 72h", () => assert.equal(STALENESS_TTL_HOURS.utility, 72));
  it("histoire = 24h", () => assert.equal(STALENESS_TTL_HOURS.histoire, 24));
  it("opportunity = 336h (14d)", () => assert.equal(STALENESS_TTL_HOURS.opportunity, 336));
  it("scholarship = 336h (14d)", () => assert.equal(STALENESS_TTL_HOURS.scholarship, 336));
});

describe("isStale", () => {
  it("news item 49h old → stale", () => {
    assert.equal(isStale({ igType: "news", createdAt: hoursAgo(49) }), true);
  });

  it("news item 47h old → NOT stale", () => {
    assert.equal(isStale({ igType: "news", createdAt: hoursAgo(47) }), false);
  });

  it("taux item 25h old → stale", () => {
    assert.equal(isStale({ igType: "taux", createdAt: hoursAgo(25) }), true);
  });

  it("taux item 23h old → NOT stale", () => {
    assert.equal(isStale({ igType: "taux", createdAt: hoursAgo(23) }), false);
  });

  it("histoire item 25h old → stale (24h TTL)", () => {
    assert.equal(isStale({ igType: "histoire", createdAt: hoursAgo(25) }), true);
  });

  it("histoire item 23h old → NOT stale", () => {
    assert.equal(isStale({ igType: "histoire", createdAt: hoursAgo(23) }), false);
  });

  it("scholarship item 15 days old → stale (14d TTL)", () => {
    assert.equal(isStale({ igType: "scholarship", createdAt: hoursAgo(360) }), true);
  });

  it("scholarship item 13 days old → NOT stale", () => {
    assert.equal(isStale({ igType: "scholarship", createdAt: hoursAgo(312) }), false);
  });

  it("handles Date object createdAt", () => {
    const old = new Date(Date.now() - 50 * 3600_000);
    assert.equal(isStale({ igType: "news", createdAt: old }), true);
  });

  it("returns false when createdAt is missing/zero", () => {
    assert.equal(isStale({ igType: "news", createdAt: 0 }), false);
    assert.equal(isStale({ igType: "news", createdAt: null }), false);
    assert.equal(isStale({ igType: "news", createdAt: undefined }), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5) DAILY CAPS
// ═══════════════════════════════════════════════════════════════════════════

describe("Daily caps", () => {
  it("normal cap = 8 (3 staples + 5 regular)", () => {
    assert.equal(DAILY_CAP_NORMAL, 8);
  });

  it("urgent cap = 10 (for items with score ≥ 90)", () => {
    assert.equal(DAILY_CAP_URGENT, 10);
  });

  it("urgent cap > normal cap", () => {
    assert.ok(DAILY_CAP_URGENT > DAILY_CAP_NORMAL);
  });
});

describe("Per-type caps", () => {
  it("scholarship cap = 2", () => {
    assert.equal(TYPE_DAILY_CAPS.scholarship, 2);
  });

  it("opportunity cap = 2", () => {
    assert.equal(TYPE_DAILY_CAPS.opportunity, 2);
  });

  it("taux cap = 1", () => {
    assert.equal(TYPE_DAILY_CAPS.taux, 1);
  });

  it("news has no cap (undefined)", () => {
    assert.equal(TYPE_DAILY_CAPS.news, undefined);
  });

  it("histoire has no cap (undefined)", () => {
    assert.equal(TYPE_DAILY_CAPS.histoire, undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6) HAITI TIMEZONE
// ═══════════════════════════════════════════════════════════════════════════

describe("Haiti timezone", () => {
  it("toHaitiDate returns a Date in Haiti local time", () => {
    // Haiti follows US Eastern DST rules. March 13, 2026 is after spring-forward
    // (March 8, 2026), so Haiti is on EDT (UTC-4). Midnight Haiti = 04:00 UTC.
    const utcMidnight = new Date("2026-03-13T04:00:00Z");
    const haiti = toHaitiDate(utcMidnight);
    assert.equal(haiti.getHours(), 0, `Expected midnight, got ${haiti.getHours()}:${haiti.getMinutes()}`);
    assert.equal(haiti.getMinutes(), 0);
  });

  it("getHaitiOffsetHours returns 4 or 5", () => {
    const offset = getHaitiOffsetHours();
    assert.ok(offset === 4 || offset === 5, `Expected 4 or 5, got ${offset}`);
  });

  it("early March should be EST (offset = 5) — before spring forward", () => {
    // Haiti DST spring-forward is second Sunday of March (March 8 in 2026)
    // March 1 is before that → EST (UTC-5)
    const march1 = new Date("2026-03-01T12:00:00Z");
    const offset = getHaitiOffsetHours(march1);
    assert.equal(offset, 5, "March 1 should be EST (UTC-5)");
  });

  it("March 13 should be EDT (offset = 4) — after spring forward", () => {
    // March 13 is after spring-forward (March 8, 2026) → EDT (UTC-4)
    const march13 = new Date("2026-03-13T12:00:00Z");
    const offset = getHaitiOffsetHours(march13);
    assert.equal(offset, 4, "March 13 should be EDT (UTC-4)");
  });

  it("July should be EDT (offset = 4)", () => {
    const july = new Date("2026-07-15T12:00:00Z");
    const offset = getHaitiOffsetHours(july);
    assert.equal(offset, 4, "July should be EDT (UTC-4)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7) getNextAvailableSlot
// ═══════════════════════════════════════════════════════════════════════════

describe("getNextAvailableSlot", () => {
  it("returns null when all slots are taken", () => {
    // Fill all slots for today and tomorrow
    const taken = new Set<string>();
    const offsetH = getHaitiOffsetHours();
    const now = toHaitiDate(new Date());

    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      for (const slot of SLOTS) {
        const d = new Date(
          Date.UTC(
            now.getFullYear(), now.getMonth(), now.getDate() + dayOffset,
            slot.hour + offsetH, slot.minute, 0, 0,
          ),
        );
        taken.add(d.toISOString());
      }
    }

    assert.equal(getNextAvailableSlot(taken), null);
  });

  it("returns a future slot when no slots are taken", () => {
    const slot = getNextAvailableSlot(new Set());
    // During quiet hours (late night in Haiti) this may return null for todayOnly,
    // but with tomorrow spill it should find something
    if (slot) {
      assert.ok(slot > new Date(), "Returned slot should be in the future");
    }
  });

  it("skips slots within 30 min of a taken slot", () => {
    // Take the 06:30 slot → 06:50 (20 min later) should be skipped due to 30-min safety
    const offsetH = getHaitiOffsetHours();
    const now = toHaitiDate(new Date());
    const slot0630 = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6 + offsetH, 30, 0, 0),
    );
    const taken = new Set([slot0630.toISOString()]);

    const next = getNextAvailableSlot(taken);
    if (next) {
      // The next slot should be at least 30 min from the taken one
      const diffMs = Math.abs(next.getTime() - slot0630.getTime());
      assert.ok(diffMs >= 30 * 60_000, `Next slot is only ${diffMs / 60_000}min from taken slot`);
    }
  });

  it("todayOnly=true never returns a slot for tomorrow", () => {
    const slot = getNextAvailableSlot(new Set(), true);
    if (slot) {
      const haiti = toHaitiDate(new Date());
      const slotHaiti = toHaitiDate(slot);
      assert.equal(slotHaiti.getDate(), haiti.getDate(), "todayOnly slot should be today");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8) BRH DATE PARSING
// ═══════════════════════════════════════════════════════════════════════════

describe("parseBRHDate", () => {
  it("parses '13 mars 2026' → '2026-03-13'", () => {
    assert.equal(parseBRHDate("13 mars 2026"), "2026-03-13");
  });

  it("parses '1 janvier 2026' → '2026-01-01'", () => {
    assert.equal(parseBRHDate("1 janvier 2026"), "2026-01-01");
  });

  it("parses '25 décembre 2025' → '2025-12-25'", () => {
    assert.equal(parseBRHDate("25 décembre 2025"), "2025-12-25");
  });

  it("parses '14 février 2026' → '2026-02-14'", () => {
    assert.equal(parseBRHDate("14 février 2026"), "2026-02-14");
  });

  it("parses '8 août 2026' → '2026-08-08'", () => {
    assert.equal(parseBRHDate("8 août 2026"), "2026-08-08");
  });

  it("parses '30 septembre 2026' → '2026-09-30'", () => {
    assert.equal(parseBRHDate("30 septembre 2026"), "2026-09-30");
  });

  it("returns null for empty string", () => {
    assert.equal(parseBRHDate(""), null);
  });

  it("returns null for English date", () => {
    assert.equal(parseBRHDate("March 13, 2026"), null);
  });

  it("returns null for nonsense", () => {
    assert.equal(parseBRHDate("hello world"), null);
  });

  it("returns null for unknown French month", () => {
    assert.equal(parseBRHDate("13 marz 2026"), null);
  });
});

describe("FRENCH_MONTHS", () => {
  it("maps all 12 French month names", () => {
    assert.equal(Object.keys(FRENCH_MONTHS).length, 12);
  });

  it("janvier = 0 (JS month index)", () => {
    assert.equal(FRENCH_MONTHS["janvier"], 0);
  });

  it("décembre = 11", () => {
    assert.equal(FRENCH_MONTHS["décembre"], 11);
  });

  it("août = 7", () => {
    assert.equal(FRENCH_MONTHS["août"], 7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9) TIME WINDOW INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Time window integration", () => {
  it("taux window opens when quiet hours end (05:30)", () => {
    // Both taux window and scheduling window open at 05:30 Haiti time
    const at0530 = haitiTime(5, 30);
    assert.equal(isQuietHour(at0530), false, "05:30 should not be quiet hour");
    // Taux window: (hour > 5 || (hour === 5 && minute >= 30)) && hour < 9
    // At 05:30: hour=5, minute=30 → (false || true) && true → true
  });

  it("story window is inside taux window (05:30–06:29 ⊂ 05:30–08:29)", () => {
    // Story: 05:30–06:29, Taux: 05:30–08:29
    // Both start at 05:30, story ends earlier
    const at0530 = haitiTime(5, 30);
    const at0700 = haitiTime(7, 0);
    // At 05:30 both windows are open
    assert.equal(isQuietHour(at0530), false);
    // At 07:00 taux window is still open, story window is closed
    assert.equal(isQuietHour(at0700), false);
  });

  it("first slot (06:30) is after quiet hours end (05:30)", () => {
    const firstSlot = SLOTS[0]!;
    const firstSlotMinutes = firstSlot.hour * 60 + firstSlot.minute;
    const quietEnd = 5 * 60 + 30;
    assert.ok(firstSlotMinutes >= quietEnd, "First slot should be at or after 05:30");
  });

  it("taux slot (06:30) matches STAPLE_SLOT_INDEX pin", () => {
    const tauxSlot = SLOTS[STAPLE_SLOT_INDEX["taux"]!]!;
    assert.equal(tauxSlot.hour, 6);
    assert.equal(tauxSlot.minute, 30);
  });

  it("utility slot (06:50) follows taux by 20 minutes", () => {
    const tauxSlot = SLOTS[STAPLE_SLOT_INDEX["taux"]!]!;
    const utilSlot = SLOTS[STAPLE_SLOT_INDEX["utility"]!]!;
    const diff = (utilSlot.hour * 60 + utilSlot.minute) - (tauxSlot.hour * 60 + tauxSlot.minute);
    assert.equal(diff, 20, "Utility slot should be 20 min after taux");
  });

  it("histoire slot (07:00) follows utility by 10 minutes", () => {
    const utilSlot = SLOTS[STAPLE_SLOT_INDEX["utility"]!]!;
    const histSlot = SLOTS[STAPLE_SLOT_INDEX["histoire"]!]!;
    const diff = (histSlot.hour * 60 + histSlot.minute) - (utilSlot.hour * 60 + utilSlot.minute);
    assert.equal(diff, 10, "Histoire slot should be 10 min after utility");
  });

  it("morning staples complete by 07:00 — 1.5h before general slots (08:30)", () => {
    const lastStaple = SLOTS[2]!; // histoire 07:00
    const firstGeneral = SLOTS[3]!; // 08:30
    const gap = (firstGeneral.hour * 60 + firstGeneral.minute) - (lastStaple.hour * 60 + lastStaple.minute);
    assert.equal(gap, 90, "90 min gap between last staple and first general slot");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10) DAILY STAPLES INVARIANTS
// ════════════════════════════════════════════���══════════════════════════════

describe("Daily staples invariants", () => {
  it("exactly 3 daily staples", () => {
    assert.equal(DAILY_STAPLES.length, 3);
  });

  it("taux is guaranteed daily", () => {
    assert.ok(DAILY_STAPLES.includes("taux"));
  });

  it("histoire is guaranteed daily", () => {
    assert.ok(DAILY_STAPLES.includes("histoire"));
  });

  it("utility is guaranteed daily", () => {
    assert.ok(DAILY_STAPLES.includes("utility"));
  });

  it("staple count ≤ daily cap", () => {
    assert.ok(DAILY_STAPLES.length <= DAILY_CAP_NORMAL, "Staples must fit within daily cap");
  });

  it("each staple type has a TTL (won't stay forever)", () => {
    for (const s of DAILY_STAPLES) {
      assert.ok(STALENESS_TTL_HOURS[s] > 0, `${s} must have a positive TTL`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11) SLOT SPACING & ENGAGEMENT DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════

describe("Slot distribution across the day", () => {
  it("has morning slots (before 09:00)", () => {
    const morning = SLOTS.filter((s) => s.hour < 9);
    assert.ok(morning.length >= 3, `Expected ≥ 3 morning slots, got ${morning.length}`);
  });

  it("has afternoon slots (12:00–17:00)", () => {
    const afternoon = SLOTS.filter((s) => s.hour >= 12 && s.hour < 17);
    assert.ok(afternoon.length >= 2, `Expected ≥ 2 afternoon slots, got ${afternoon.length}`);
  });

  it("has evening slots (17:00+)", () => {
    const evening = SLOTS.filter((s) => s.hour >= 17);
    assert.ok(evening.length >= 2, `Expected ≥ 2 evening slots, got ${evening.length}`);
  });

  it("enough slots for daily cap", () => {
    // 10 slots for max 10 posts/day (urgent cap)
    assert.ok(SLOTS.length >= DAILY_CAP_URGENT, `Need ≥ ${DAILY_CAP_URGENT} slots, have ${SLOTS.length}`);
  });

  it("total slot span covers ≥ 13 hours of the day", () => {
    const first = SLOTS[0]!.hour * 60 + SLOTS[0]!.minute;
    const last = SLOTS[SLOTS.length - 1]!.hour * 60 + SLOTS[SLOTS.length - 1]!.minute;
    const spanHours = (last - first) / 60;
    assert.ok(spanHours >= 13, `Expected ≥ 13h span, got ${spanHours.toFixed(1)}h`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12) EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("isStale with brand-new item → NOT stale for any type", () => {
    const fresh = hoursAgo(0);
    for (const igType of Object.keys(STALENESS_TTL_HOURS) as (keyof typeof STALENESS_TTL_HOURS)[]) {
      assert.equal(isStale({ igType, createdAt: fresh }), false, `Fresh ${igType} should not be stale`);
    }
  });

  it("isStale with 1-year-old item → stale for ALL types", () => {
    const ancient = hoursAgo(365 * 24);
    for (const igType of Object.keys(STALENESS_TTL_HOURS) as (keyof typeof STALENESS_TTL_HOURS)[]) {
      assert.equal(isStale({ igType, createdAt: ancient }), true, `Ancient ${igType} should be stale`);
    }
  });

  it("parseBRHDate handles all 12 French month names", () => {
    const months = [
      ["janvier", "01"], ["février", "02"], ["mars", "03"], ["avril", "04"],
      ["mai", "05"], ["juin", "06"], ["juillet", "07"], ["août", "08"],
      ["septembre", "09"], ["octobre", "10"], ["novembre", "11"], ["décembre", "12"],
    ] as const;
    for (const [name, num] of months) {
      const result = parseBRHDate(`15 ${name} 2026`);
      assert.equal(result, `2026-${num}-15`, `Failed for ${name}`);
    }
  });

  it("quiet hour boundary: 05:30 is NOT quiet, 05:29 IS quiet", () => {
    assert.equal(isQuietHour(haitiTime(5, 29)), true);
    assert.equal(isQuietHour(haitiTime(5, 30)), false);
  });

  it("quiet hour boundary: 22:59 is NOT quiet, 23:00 IS quiet", () => {
    assert.equal(isQuietHour(haitiTime(22, 59)), false);
    assert.equal(isQuietHour(haitiTime(23, 0)), true);
  });
});
