/**
 * Meme generation tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMemeWorthy, getMemeTemplates } from "./meme.js";
import type { Item } from "@edlight-news/types";

// Minimal mock item factory
function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "test-1",
    title: "Bourse Fulbright 2026 pour étudiants haïtiens",
    summary: "La bourse Fulbright accepte les candidatures pour 2026.",
    extractedText: "",
    category: "scholarship",
    canonicalUrl: "https://example.com",
    geoTag: "HT",
    status: "published",
    qualityFlags: { audienceFit: 0.8 },
    ...overrides,
  } as unknown as Item;
}

describe("isMemeWorthy", () => {
  it("returns true for scholarship items", () => {
    const item = makeItem({ category: "scholarship" });
    assert.equal(isMemeWorthy(item, "scholarship"), true);
  });

  it("returns true for opportunity items", () => {
    const item = makeItem({ category: "opportunity" });
    assert.equal(isMemeWorthy(item, "opportunity"), true);
  });

  it("returns true for histoire items", () => {
    const item = makeItem({ category: "news" });
    assert.equal(isMemeWorthy(item, "histoire"), true);
  });

  it("returns true for Haiti-tagged high-fit news", () => {
    const item = makeItem({
      category: "news",
      geoTag: "HT",
      audienceFitScore: 0.8,
    });
    assert.equal(isMemeWorthy(item, "news"), true);
  });

  it("returns false for low-fit non-Haiti news", () => {
    const item = makeItem({
      category: "news",
      geoTag: "Global",
      audienceFitScore: 0.3,
    });
    assert.equal(isMemeWorthy(item, "news"), false);
  });

  it("returns true for student-centric utility items", () => {
    const item = makeItem({
      title: "Guide d'inscription universitaire",
      category: "resource",
    });
    assert.equal(isMemeWorthy(item, "utility"), true);
  });

  it("returns false for non-student utility items", () => {
    const item = makeItem({
      title: "Taux du dollar aujourd'hui",
      category: "resource",
    });
    assert.equal(isMemeWorthy(item, "utility"), false);
  });
});

describe("getMemeTemplates", () => {
  it("returns at least 5 templates", () => {
    const templates = getMemeTemplates();
    assert.ok(templates.length >= 5, `Expected ≥5 templates, got ${templates.length}`);
  });

  it("each template has valid panel count", () => {
    for (const t of getMemeTemplates()) {
      assert.ok(t.panels >= 2 && t.panels <= 4, `Template ${t.id} has invalid panel count: ${t.panels}`);
    }
  });

  it("includes drake and expanding-brain", () => {
    const ids = getMemeTemplates().map((t) => t.id);
    assert.ok(ids.includes("drake"));
    assert.ok(ids.includes("expanding-brain"));
  });
});
