import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTemplate, TEMPLATE_PREFERENCE } from "./pickTemplate.js";
import type { ReelTopic, ReelTemplate } from "./types.js";

const TOPICS: ReelTopic[] = [
  "scholarship",
  "opportunity",
  "taux",
  "news",
  "histoire",
  "fact",
  "education",
];

test("every topic has at least one allowed template", () => {
  for (const t of TOPICS) {
    assert.ok(
      TEMPLATE_PREFERENCE[t] && TEMPLATE_PREFERENCE[t].length > 0,
      `${t} must have at least one template`,
    );
  }
});

test("pickTemplate is deterministic for the same inputs", () => {
  const a = pickTemplate("scholarship", 3, "item-abc-123");
  const b = pickTemplate("scholarship", 3, "item-abc-123");
  assert.equal(a, b);
});

test("pickTemplate spreads across templates over a 7-day window", () => {
  for (const t of TOPICS) {
    const seen = new Set<ReelTemplate>();
    for (let day = 0; day < 7; day++) {
      seen.add(pickTemplate(t, day, "item-stable-1"));
    }
    // For topics with multiple templates we should hit at least 2 distinct
    // templates across a week — single-template topics are exempt.
    const allowedCount = TEMPLATE_PREFERENCE[t].length;
    if (allowedCount > 1) {
      assert.ok(
        seen.size >= 2,
        `${t} only produced ${seen.size} distinct template(s) across 7 days`,
      );
    }
  }
});

test("pickTemplate only returns templates from the allowed list per topic", () => {
  for (const t of TOPICS) {
    const allowed = new Set(TEMPLATE_PREFERENCE[t]);
    for (let day = 0; day < 7; day++) {
      for (let i = 0; i < 25; i++) {
        const got = pickTemplate(t, day, `item-${i}`);
        assert.ok(allowed.has(got), `${t} produced disallowed template ${got}`);
      }
    }
  }
});

test("pickTemplate throws on unknown topic", () => {
  assert.throws(
    () => pickTemplate("nonsense" as ReelTopic, 0, "x"),
    /no preference list/,
  );
});
