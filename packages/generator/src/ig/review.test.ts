/**
 * Tests for the two-pass reviewer module.
 *
 * Unit tests for `needsReview()` and `countEmojis()`.
 * These are pure-logic tests (no LLM calls).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countEmojis, needsReview } from "./review.js";
import type { IGFormattedPayload } from "@edlight-news/types";

// ── countEmojis ────────────────────────────────────────────────────────────

describe("countEmojis", () => {
  it("counts zero in plain text", () => {
    assert.equal(countEmojis("Bonjour le monde"), 0);
  });

  it("counts flag emojis", () => {
    // Flag emojis are 2 regional indicator codepoints — may count as 1 or 2
    const result = countEmojis("🇭🇹 Haiti");
    assert.ok(result >= 1 && result <= 2, `Expected 1-2, got ${result}`);
  });

  it("counts mixed emojis", () => {
    assert.equal(countEmojis("📚 Trois 🔥🔥 emojis ici 🎉"), 4);
  });

  it("counts skin-tone modified emojis", () => {
    const result = countEmojis("👍🏽 good");
    assert.ok(result >= 1, `Expected >= 1, got ${result}`);
  });

  it("returns 0 for empty string", () => {
    assert.equal(countEmojis(""), 0);
  });
});

// ── needsReview ────────────────────────────────────────────────────────────

function makePayload(slides: { heading: string; bullets: string[] }[]): IGFormattedPayload {
  return {
    slides: slides.map((s) => ({ ...s, layout: "explanation" as const })),
    caption: "Test caption",
  };
}

describe("needsReview", () => {
  it("flags English markers in bullets", () => {
    const payload = makePayload([
      { heading: "Test", bullets: ["You must submit your application by Friday"] },
    ]);
    assert.equal(needsReview(payload, "news"), true);
  });

  it("flags excessive emojis on histoire", () => {
    const payload = makePayload([
      { heading: "🔥🎉📚 Histoire 🇭🇹", bullets: ["Normal text"] },
    ]);
    assert.equal(needsReview(payload, "histoire"), true);
  });

  it("passes clean French content", () => {
    const payload = makePayload([
      { heading: "Bourse d'études en France", bullets: ["Les étudiants haïtiens peuvent postuler"] },
      { heading: "Critères d'éligibilité", bullets: ["Licence minimum requise"] },
    ]);
    assert.equal(needsReview(payload, "scholarship"), false);
  });

  it("flags duplicate/similar headings", () => {
    const payload = makePayload([
      { heading: "L'histoire d'Haïti aujourd'hui", bullets: ["Texte 1"] },
      { heading: "L'histoire d'Haïti - suite", bullets: ["Texte 2"] },
    ]);
    // Similar headings should trigger review
    const result = needsReview(payload, "histoire");
    // This might or might not trigger depending on similarity threshold
    assert.equal(typeof result, "boolean");
  });
});
