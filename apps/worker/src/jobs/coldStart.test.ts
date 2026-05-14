/**
 * Cold-Start Mode tests — covers:
 *   • `services/coldStart.ts` flag + boot-log latch
 *   • Per-scheduler activeDailyCap() / activeSlots() resolvers (FB / Th / X / Wa)
 *   • IG scheduler's activeTypeCaps + activeDailyCap{Normal,Urgent}
 *   • IG EVENING_BY_WEEKDAY map + preferredToIgType
 *   • buildPollStoryFromTopic deterministic rotation
 *
 * Strategy: we mutate `process.env.COLD_START_MODE` in each test and call
 * the exported active* helpers — they read the flag at call time. We do
 * NOT exercise the schedulers' Firestore paths here; cap+slot resolution
 * is the contract under test.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  isColdStartMode,
  logColdStartBootOnce,
  _resetColdStartBootLogForTest,
} from "../services/coldStart.js";

import * as Fb from "./scheduleFbPost.js";
import * as Th from "./scheduleThPost.js";
import * as X  from "./scheduleXPost.js";
import * as Wa from "./scheduleWaPost.js";
import * as Ig from "./scheduleIgPost.js";

import {
  buildPollStoryFromTopic,
  pickPollTemplate,
  POLL_TEMPLATES,
} from "./buildPollStoryFromTopic.js";

// ────────────────────────────────────────────────────────────────────────
// shared env scaffolding
// ────────────────────────────────────────────────────────────────────────

const ORIGINAL_COLD_START = process.env.COLD_START_MODE;

function setColdStart(on: boolean) {
  if (on) {
    process.env.COLD_START_MODE = "true";
  } else {
    delete process.env.COLD_START_MODE;
  }
  _resetColdStartBootLogForTest();
}

afterEach(() => {
  if (ORIGINAL_COLD_START === undefined) {
    delete process.env.COLD_START_MODE;
  } else {
    process.env.COLD_START_MODE = ORIGINAL_COLD_START;
  }
  _resetColdStartBootLogForTest();
});

// ────────────────────────────────────────────────────────────────────────
// services/coldStart
// ────────────────────────────────────────────────────────────────────────

describe("services/coldStart", () => {
  it("isColdStartMode() reads the env flag at call time", () => {
    setColdStart(false);
    assert.equal(isColdStartMode(), false);
    setColdStart(true);
    assert.equal(isColdStartMode(), true);
  });

  it('treats any value other than "true" as off', () => {
    process.env.COLD_START_MODE = "1";
    assert.equal(isColdStartMode(), false);
    process.env.COLD_START_MODE = "TRUE";
    assert.equal(isColdStartMode(), false);
    process.env.COLD_START_MODE = "yes";
    assert.equal(isColdStartMode(), false);
  });

  it("logColdStartBootOnce() emits exactly once per process and only when on", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => logs.push(String(msg));
    try {
      setColdStart(true);
      logColdStartBootOnce();
      logColdStartBootOnce();
      logColdStartBootOnce();
      const bootLogs = logs.filter((l) => l.includes("coldStartModeActive"));
      assert.equal(bootLogs.length, 1, "boot log must be idempotent");
    } finally {
      console.log = origLog;
    }
  });

  it("logColdStartBootOnce() is a no-op when the flag is off", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => logs.push(String(msg));
    try {
      setColdStart(false);
      logColdStartBootOnce();
      const bootLogs = logs.filter((l) => l.includes("coldStartModeActive"));
      assert.equal(bootLogs.length, 0);
    } finally {
      console.log = origLog;
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Scheduler cap + slot resolvers — table-driven across FB / Th / X / Wa
// ────────────────────────────────────────────────────────────────────────

const SIMPLE_SCHEDULERS = [
  {
    name: "FB",
    mod: Fb,
    scaleCap: 13,
    coldCap: 1,
    scaleSlotCount: 13,
    coldSlots: [{ hour: 12, minute: 0 }],
  },
  {
    name: "Threads",
    mod: Th,
    scaleCap: 12,
    coldCap: 4,
    scaleSlotCount: 12,
    coldSlots: [
      { hour: 8,  minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 16, minute: 0 },
      { hour: 20, minute: 0 },
    ],
  },
  {
    name: "X",
    mod: X,
    scaleCap: 15,
    coldCap: 2,
    scaleSlotCount: 15,
    coldSlots: [
      { hour: 9,  minute: 0 },
      { hour: 18, minute: 0 },
    ],
  },
  {
    name: "WhatsApp",
    mod: Wa,
    scaleCap: 8,
    coldCap: 1,
    scaleSlotCount: 8,
    coldSlots: [{ hour: 10, minute: 0 }],
  },
] as const;

for (const s of SIMPLE_SCHEDULERS) {
  describe(`${s.name} scheduler — cold-start vs scale`, () => {
    it("scale-mode cap matches expected", () => {
      setColdStart(false);
      assert.equal(s.mod.activeDailyCap(), s.scaleCap);
      assert.equal(s.mod.DAILY_CAP_SCALE, s.scaleCap);
    });

    it("cold-start cap matches expected", () => {
      setColdStart(true);
      assert.equal(s.mod.activeDailyCap(), s.coldCap);
      assert.equal(s.mod.DAILY_CAP_COLD_START, s.coldCap);
    });

    it("scale-mode slot count matches expected", () => {
      setColdStart(false);
      assert.equal(s.mod.activeSlots().length, s.scaleSlotCount);
      assert.equal(s.mod.SLOTS_SCALE.length, s.scaleSlotCount);
    });

    it("cold-start slots match expected list exactly", () => {
      setColdStart(true);
      const slots = s.mod.activeSlots();
      assert.equal(slots.length, s.coldSlots.length);
      for (let i = 0; i < s.coldSlots.length; i++) {
        assert.equal(slots[i]!.hour, s.coldSlots[i]!.hour, `slot ${i} hour`);
        assert.equal(slots[i]!.minute, s.coldSlots[i]!.minute, `slot ${i} minute`);
      }
    });

    it("cold-start cap is strictly smaller than scale cap", () => {
      assert.ok(s.coldCap < s.scaleCap, `${s.name}: cold ${s.coldCap} should be < scale ${s.scaleCap}`);
    });

    it("active resolvers re-read the env flag between calls", () => {
      setColdStart(false);
      const scaleCap = s.mod.activeDailyCap();
      setColdStart(true);
      const coldCap = s.mod.activeDailyCap();
      setColdStart(false);
      const scaleCap2 = s.mod.activeDailyCap();
      assert.equal(scaleCap, s.scaleCap);
      assert.equal(coldCap, s.coldCap);
      assert.equal(scaleCap2, s.scaleCap);
    });
  });
}

// ────────────────────────────────────────────────────────────────────────
// IG scheduler — caps, type caps, weekday calendar
// ────────────────────────────────────────────────────────────────────────

describe("IG scheduler — cold-start caps", () => {
  it("scale-mode normal cap = 8, urgent cap = 10", () => {
    setColdStart(false);
    assert.equal(Ig.activeDailyCapNormal(), 8);
    assert.equal(Ig.activeDailyCapUrgent(), 10);
  });

  it("cold-start collapses both caps to 2", () => {
    setColdStart(true);
    assert.equal(Ig.activeDailyCapNormal(), 2);
    assert.equal(Ig.activeDailyCapUrgent(), 2);
    assert.equal(Ig.DAILY_CAP_COLD_START, 2);
  });

  it("back-compat exports remain pinned to scale-mode constants", () => {
    // These are read by external scripts/tests that haven't been updated.
    setColdStart(true);
    assert.equal(Ig.DAILY_CAP_NORMAL, 8);
    assert.equal(Ig.DAILY_CAP_URGENT, 10);
    // The active resolvers, however, follow the flag.
    assert.equal(Ig.activeDailyCapNormal(), 2);
  });
});

describe("IG scheduler — type caps", () => {
  it("scale-mode caps scholarship/opportunity/taux", () => {
    setColdStart(false);
    const caps = Ig.activeTypeCaps();
    assert.equal(caps.scholarship, 3);
    assert.equal(caps.opportunity, 2);
    assert.equal(caps.taux, 1);
    assert.equal(caps.histoire, undefined);
    assert.equal(caps.news, undefined);
  });

  it("cold-start caps EVERY type at 1", () => {
    setColdStart(true);
    const caps = Ig.activeTypeCaps();
    for (const t of ["scholarship", "opportunity", "taux", "histoire", "utility", "news"] as const) {
      assert.equal(caps[t], 1, `type ${t} should be capped at 1 in cold-start`);
    }
  });
});

describe("IG scheduler — EVENING_BY_WEEKDAY", () => {
  it("covers all 7 weekdays (0=Sun..6=Sat)", () => {
    for (let d = 0; d <= 6; d++) {
      const pref = Ig.EVENING_BY_WEEKDAY[d];
      assert.ok(Array.isArray(pref) && pref.length > 0, `weekday ${d} must have ≥1 preference`);
    }
  });

  it("matches the published calendar exactly", () => {
    assert.deepEqual(Ig.EVENING_BY_WEEKDAY[0], ["news", "histoire"]);
    assert.deepEqual(Ig.EVENING_BY_WEEKDAY[1], ["scholarship"]);
    assert.deepEqual(Ig.EVENING_BY_WEEKDAY[2], ["fact"]);
    assert.deepEqual(Ig.EVENING_BY_WEEKDAY[3], ["scholarship"]);
    assert.deepEqual(Ig.EVENING_BY_WEEKDAY[4], ["histoire"]);
    assert.deepEqual(Ig.EVENING_BY_WEEKDAY[5], ["scholarship"]);
    assert.deepEqual(Ig.EVENING_BY_WEEKDAY[6], ["histoire", "fact"]);
  });

  it('preferredToIgType maps "fact" → "utility" and passes others through', () => {
    assert.equal(Ig.preferredToIgType("fact"), "utility");
    assert.equal(Ig.preferredToIgType("scholarship"), "scholarship");
    assert.equal(Ig.preferredToIgType("histoire"), "histoire");
    assert.equal(Ig.preferredToIgType("news"), "news");
  });
});

// ────────────────────────────────────────────────────────────────────────
// buildPollStoryFromTopic
// ────────────────────────────────────────────────────────────────────────

describe("buildPollStoryFromTopic", () => {
  it("returns a deterministic template per (topic, dateKey)", () => {
    const a = buildPollStoryFromTopic("taux", "2026-05-13");
    const b = buildPollStoryFromTopic("taux", "2026-05-13");
    assert.deepEqual(a, b);
  });

  it("rotates through the pool across consecutive days", () => {
    const seen = new Set<string>();
    for (let day = 1; day <= POLL_TEMPLATES.taux.length; day++) {
      const dateKey = `2026-05-${String(day).padStart(2, "0")}`;
      seen.add(buildPollStoryFromTopic("taux", dateKey).templateId);
    }
    assert.equal(seen.size, POLL_TEMPLATES.taux.length, "every template should appear exactly once over a full cycle");
  });

  it("payload preserves topic + dateKey + choice tuple", () => {
    const out = buildPollStoryFromTopic("scholarship", "2026-01-15");
    assert.equal(out.topic, "scholarship");
    assert.equal(out.dateKey, "2026-01-15");
    assert.equal(out.choices.length, 2);
    assert.ok(out.questionFr.length > 0);
    // questionHt falls back to FR when not set
    assert.ok(out.questionHt.length > 0);
  });

  it("throws on unknown topic", () => {
    assert.throws(
      // @ts-expect-error — testing runtime guard
      () => pickPollTemplate("unknown-topic", "2026-05-13"),
      /no templates/i,
    );
  });

  it("each template has a stable id and exactly 2 choices ≤ 24 chars", () => {
    for (const [topic, pool] of Object.entries(POLL_TEMPLATES)) {
      for (const tpl of pool) {
        assert.ok(tpl.id.startsWith(topic + "."), `id ${tpl.id} must start with topic prefix`);
        assert.equal(tpl.choices.length, 2, `template ${tpl.id} must have 2 choices`);
        for (const c of tpl.choices) {
          assert.ok(c.length > 0 && c.length <= 24, `choice "${c}" must be 1-24 chars`);
        }
      }
    }
  });
});
