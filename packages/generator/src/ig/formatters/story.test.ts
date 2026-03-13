/**
 * Tests for the daily summary story formatter (v2 — Morning Briefing).
 *
 * Validates:
 *  - Taux frame generation when taux data is provided
 *  - Facts frame generation when facts are provided
 *  - Bonus headline items are included
 *  - frameType assignments are correct
 *  - Fallback when no data is provided
 *  - Backward compat: old callers with just (items, date) still work
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDailySummaryStory } from "./story.js";
import type { Item } from "@edlight-news/types";

function makeItem(overrides?: Partial<Item>): Item {
  return {
    id: "test-item-1",
    title: "Bourse du gouvernement français",
    summary: "Programme de bourses pour étudiants haïtiens",
    canonicalUrl: "https://example.com/bourse",
    category: "scholarship",
    itemType: "source",
    status: "published",
    locale: "fr",
    publishedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    ...overrides,
  } as Item;
}

describe("buildDailySummaryStory (v2)", () => {
  it("creates taux frame when taux data is provided", () => {
    const result = buildDailySummaryStory(
      [],
      new Date("2026-03-13"),
      { rate: "131.2589", dateLabel: "13 mars 2026", bullets: ["Achat: 130.50"] },
    );

    assert.ok(result.slides.length >= 1);
    const tauxFrame = result.slides.find((s) => s.frameType === "taux");
    assert.ok(tauxFrame, "Should have a taux frame");
    assert.equal(tauxFrame.heading, "131.2589");
    assert.ok(tauxFrame.bullets.includes("13 mars 2026"));
  });

  it("creates facts frame when facts are provided", () => {
    const result = buildDailySummaryStory(
      [],
      new Date("2026-03-13"),
      undefined,
      { facts: ["Haïti a été le premier pays noir indépendant", "Le drapeau a été créé le 18 mai 1803"] },
    );

    const factsFrame = result.slides.find((s) => s.frameType === "facts");
    assert.ok(factsFrame, "Should have a facts frame");
    assert.equal(factsFrame.heading, "Le saviez-vous ?");
    assert.equal(factsFrame.bullets.length, 2);
  });

  it("creates headline frames for bonus items", () => {
    const items = [
      { item: makeItem({ title: "Bourse UNESCO 2026" }), bi: { frTitle: "Bourse UNESCO 2026", frSummary: "Postulez maintenant" } },
      { item: makeItem({ id: "test-2", title: "Concours MENFP", category: "opportunity" as any }), bi: { frTitle: "Concours MENFP", frSummary: "Inscriptions ouvertes" } },
    ];
    const result = buildDailySummaryStory(items, new Date("2026-03-13"));

    const headlineFrames = result.slides.filter((s) => s.frameType === "headline");
    assert.equal(headlineFrames.length, 2);
  });

  it("limits bonus items to 4", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      item: makeItem({ id: `item-${i}`, title: `Item ${i}` }),
    }));
    const result = buildDailySummaryStory(items, new Date("2026-03-13"));

    const headlineFrames = result.slides.filter((s) => s.frameType === "headline");
    assert.ok(headlineFrames.length <= 4, `Expected max 4, got ${headlineFrames.length}`);
  });

  it("includes all frame types in full story", () => {
    const items = [
      { item: makeItem({ title: "Test Article" }), bi: { frTitle: "Article Test", frSummary: "Résumé test" } },
    ];
    const result = buildDailySummaryStory(
      items,
      new Date("2026-03-13"),
      { rate: "131.00", dateLabel: "13 mars 2026" },
      { facts: ["Fait intéressant"] },
    );

    const frameTypes = result.slides.map((s) => s.frameType);
    assert.ok(frameTypes.includes("taux"), "Should have taux frame");
    assert.ok(frameTypes.includes("facts"), "Should have facts frame");
    assert.ok(frameTypes.includes("headline"), "Should have headline frame");
  });

  it("falls back to cover frame when no data at all", () => {
    const result = buildDailySummaryStory([], new Date("2026-03-13"));

    assert.equal(result.slides.length, 1);
    assert.equal(result.slides[0]!.frameType, "cover");
  });

  it("backward compat: works with just (items, date)", () => {
    const items = [
      { item: makeItem(), bi: { frTitle: "Bourse", frSummary: "Résumé" } },
    ];
    const result = buildDailySummaryStory(items, new Date("2026-03-13"));

    assert.ok(result.slides.length >= 1);
    assert.equal(result.dateLabel, "13 mars 2026");
  });

  it("includes dateLabel in payload", () => {
    const result = buildDailySummaryStory([], new Date("2026-03-13"));
    assert.equal(result.dateLabel, "13 mars 2026");
  });

  it("includes deadline in scholarship headline bullets", () => {
    const items = [
      {
        item: makeItem({
          title: "Bourse X",
          category: "scholarship" as any,
          deadline: "2026-06-30",
        }),
        bi: { frTitle: "Bourse X", frSummary: "Résumé court" },
      },
    ];
    const result = buildDailySummaryStory(items, new Date("2026-03-13"));

    const headlineFrame = result.slides.find((s) => s.frameType === "headline");
    assert.ok(headlineFrame);
    const deadlineBullet = headlineFrame.bullets.find((b) => b.includes("Date limite"));
    assert.ok(deadlineBullet, "Should include deadline bullet");
  });
});
