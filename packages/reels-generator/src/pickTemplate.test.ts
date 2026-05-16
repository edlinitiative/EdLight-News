import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickTemplate,
  pickTemplateWithDowngrade,
  TEMPLATE_PREFERENCE,
} from "./pickTemplate.js";
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

// ── pickTemplateWithDowngrade — content-aware downgrade rules ─────────

test("pickTemplateWithDowngrade keeps BigStatistic when a salient currency exists", () => {
  const candidate = findInitialPick("scholarship", "BigStatistic");
  if (!candidate) throw new Error("expected to find an item that resolves to BigStatistic");
  const result = pickTemplateWithDowngrade(
    "scholarship",
    candidate.day,
    candidate.itemId,
    {
      title: "Bourse Fulbright",
      summary: "Bourses jusqu'à $5,000 USD pour 25 candidats avant le 15 mars 2026.",
    },
  );
  assert.equal(result.template, "BigStatistic");
  assert.equal(result.downgraded, false);
  if (!result.heroNumber) throw new Error("expected a hero number");
  assert.equal(result.heroNumber.kind, "currency");
});

test("pickTemplateWithDowngrade downgrades BigStatistic when only a year is salient", () => {
  // The v1 regression: scholarship reel rendered with hero "2026".
  const candidate = findInitialPick("scholarship", "BigStatistic");
  if (!candidate) throw new Error("expected to find an item that resolves to BigStatistic");
  const result = pickTemplateWithDowngrade(
    "scholarship",
    candidate.day,
    candidate.itemId,
    {
      title: "Rétrospective 2026",
      summary: "Une année charnière pour le programme.",
    },
  );
  assert.notEqual(result.template, "BigStatistic", "must downgrade off BigStatistic");
  assert.equal(result.downgraded, true);
  assert.equal(result.from, "BigStatistic");
  assert.match(result.reason ?? "", /salient-number|year/);
});

test("pickTemplateWithDowngrade does not touch non-BigStatistic picks", () => {
  const candidate = findInitialPick("opportunity", "HeadlinePhoto");
  if (!candidate) throw new Error("expected an item that resolves to HeadlinePhoto");
  const result = pickTemplateWithDowngrade(
    "opportunity",
    candidate.day,
    candidate.itemId,
    { title: "Stage en marketing", summary: "Aucune date ni montant." },
  );
  assert.equal(result.template, "HeadlinePhoto");
  assert.equal(result.downgraded, false);
});

/** Search a small day×item space for an input that picks `wanted`. */
function findInitialPick(
  topic: ReelTopic,
  wanted: ReelTemplate,
): { day: number; itemId: string } | null {
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < 50; i++) {
      const id = `find-${i}`;
      if (pickTemplate(topic, day, id) === wanted) return { day, itemId: id };
    }
  }
  return null;
}

