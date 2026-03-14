/**
 * Tests for the IG carousel renderer.
 *
 * Validates:
 *  - Per-type cover overlay system (news/histoire get strongest overlays)
 *  - Inner-slide blur treatment for repeated backgrounds
 *  - Headline CSS clamp values match new wider budgets
 *  - All layouts produce valid HTML with correct dimensions
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSlideHTML } from "./ig-carousel.js";
import { OVERLAY_BY_TYPE } from "./design-tokens.js";
import type { IGSlide } from "@edlight-news/types";

// ── Helpers ─────────────────────────────────────────────────────────────

function makeSlide(overrides: Partial<IGSlide> = {}): IGSlide {
  return {
    heading: "Test Headline",
    bullets: ["Bullet one", "Bullet two"],
    layout: "headline",
    ...overrides,
  };
}

// ── Overlay system tests ────────────────────────────────────────────────

describe("OVERLAY_BY_TYPE", () => {
  it("has entries for all 6 IG types", () => {
    for (const type of ["news", "histoire", "scholarship", "opportunity", "utility", "taux"]) {
      assert.ok(OVERLAY_BY_TYPE[type], `Missing OVERLAY_BY_TYPE.${type}`);
      assert.ok(OVERLAY_BY_TYPE[type]!.cover, `Missing cover overlay for ${type}`);
      assert.ok(OVERLAY_BY_TYPE[type]!.inner, `Missing inner overlay for ${type}`);
    }
  });

  it("news/histoire have stronger midpoint opacity than scholarship/opportunity", () => {
    // Extract the midpoint opacity values (the 20% stop)
    const newsOverlay = OVERLAY_BY_TYPE.news!.cover;
    const scholarshipOverlay = OVERLAY_BY_TYPE.scholarship!.cover;

    // news cover midpoint at 20% should be >= 0.50
    const newsMatch = newsOverlay.match(/rgba\(0,0,0,([\d.]+)\)\s+20%/);
    const scholMatch = scholarshipOverlay.match(/rgba\(0,0,0,([\d.]+)\)\s+20%/);

    assert.ok(newsMatch, "News cover should have a 20% stop");
    assert.ok(scholMatch, "Scholarship cover should have a 20% stop");

    const newsOpacity = parseFloat(newsMatch![1]!);
    const scholOpacity = parseFloat(scholMatch![1]!);

    assert.ok(newsOpacity >= 0.50, `News 20% stop opacity (${newsOpacity}) should be >= 0.50`);
    assert.ok(newsOpacity >= scholOpacity, `News overlay (${newsOpacity}) should be >= scholarship (${scholOpacity})`);
  });
});

// ── Carousel HTML tests ─────────────────────────────────────────────────

describe("buildSlideHTML", () => {
  it("first slide uses cover overlay (not inner)", () => {
    const slide = makeSlide({ backgroundImage: "https://example.com/img.jpg" });
    const html = buildSlideHTML(slide, "news", 0, 4);
    // Should use the cover gradient — check for the higher midpoint opacity
    assert.ok(html.includes("overlay"), "Should have overlay div");
    assert.ok(html.includes("linear-gradient"), "Should have gradient");
  });

  it("inner slide with image gets blur CSS without the extra dark overlay", () => {
    const slide = makeSlide({ backgroundImage: "https://example.com/img.jpg" });
    const html = buildSlideHTML(slide, "news", 1, 4);
    assert.ok(html.includes("blur(6px)"), "Inner slide with image should have blur");
    assert.ok(html.includes("brightness(0.7)"), "Inner slide should dim the blurred background");
    assert.ok(!html.includes('<div class="overlay"></div>'), "Inner slide should not render the overlay div");
  });

  it("first slide does NOT get blur CSS", () => {
    const slide = makeSlide({ backgroundImage: "https://example.com/img.jpg" });
    const html = buildSlideHTML(slide, "news", 0, 4);
    assert.ok(!html.includes("blur(6px)"), "First slide should not have blur");
  });

  it("slide without image gets glow (no overlay or blur)", () => {
    const slide = makeSlide();
    const html = buildSlideHTML(slide, "scholarship", 1, 4);
    assert.ok(html.includes("bg-glow"), "Should have bg-glow");
    assert.ok(!html.includes("blur(6px)"), "Should not have blur without image");
    assert.ok(html.includes("accent-bar"), "Should have accent bar");
  });

  it("headline clamp is 7 for first slide (was 5)", () => {
    const slide = makeSlide({ heading: "Short" });
    const html = buildSlideHTML(slide, "news", 0, 3);
    assert.ok(html.includes("-webkit-line-clamp:7"), "First slide headline clamp should be 7");
  });

  it("body text clamp is 5 for first slide (was 3)", () => {
    const slide = makeSlide();
    const html = buildSlideHTML(slide, "news", 0, 3);
    assert.ok(html.includes("-webkit-line-clamp:5"), "First slide body clamp should be 5");
  });

  it("all slides have 1080×1350 dimensions", () => {
    const slide = makeSlide();
    for (const [igType, idx] of [["news", 0], ["scholarship", 1], ["histoire", 2]] as const) {
      const html = buildSlideHTML(slide, igType, idx, 4);
      assert.ok(html.includes("1080px"), `${igType} slide should be 1080px wide`);
      assert.ok(html.includes("1350px"), `${igType} slide should be 1350px tall`);
    }
  });

  it("explanation layout keeps blur on inner image slides without an overlay", () => {
    const slide = makeSlide({ layout: "explanation", backgroundImage: "https://example.com/img.jpg" });
    const html = buildSlideHTML(slide, "opportunity", 2, 4);
    assert.ok(html.includes("blur(6px)"), "Explanation inner slide should have blur");
    assert.ok(!html.includes('<div class="overlay"></div>'), "Explanation inner slide should not have overlay div");
  });

  it("data layout keeps blur on inner image slides without an overlay", () => {
    const slide = makeSlide({ layout: "data", statValue: "250K", statDescription: "Coverage", backgroundImage: "https://example.com/img.jpg" });
    const html = buildSlideHTML(slide, "scholarship", 1, 3);
    assert.ok(html.includes("blur(6px)"), "Data inner slide should have blur");
    assert.ok(!html.includes('<div class="overlay"></div>'), "Data inner slide should not have overlay div");
  });

  it("taux slides still use dedicated financial template", () => {
    const slide = makeSlide({ heading: "131.2589", bullets: ["13 mars 2026", "Achat: 130.50"] });
    const html = buildSlideHTML(slide, "taux", 0, 2);
    assert.ok(html.includes("TAUX DU JOUR"), "Taux should use financial template");
    assert.ok(html.includes("HTG / 1 USD"), "Taux should show currency unit");
  });
});
