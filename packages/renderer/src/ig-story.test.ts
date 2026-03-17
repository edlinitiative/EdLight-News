/**
 * Tests for the IG story renderer frame dispatch.
 *
 * Validates:
 *  - @edlight.news handle in CTA frame (not @edlightnews)
 *  - Taux frame renders with financial card layout
 *  - Facts frame renders with numbered facts
 *  - Headline frame renders article summary
 *  - frameType dispatch works correctly
 *  - Legacy slides without frameType still work
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStorySlideHTML } from "./ig-story.js";
import type { IGStorySlide } from "@edlight-news/types";

describe("buildStorySlideHTML", () => {
  it("CTA frame uses @edlight.news handle", () => {
    const slide: IGStorySlide = { heading: "", bullets: [], accent: "#14b8a6" };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 5, 6, true);
    assert.ok(html.includes("@edlight.news"), "Should contain @edlight.news");
    assert.ok(
      !html.includes("@edlightnews"),
      "Should NOT contain @edlightnews (without dot)",
    );
  });

  it("dispatches taux frameType to financial card", () => {
    const slide: IGStorySlide = {
      heading: "131.2589",
      bullets: ["13 mars 2026", "Achat: 130.50"],
      accent: "#eab308",
      frameType: "taux",
    };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 0, 5);
    assert.ok(
      html.includes("TAUX DU JOUR"),
      "Should contain TAUX DU JOUR pill",
    );
    assert.ok(html.includes("131.2589"), "Should contain the rate");
    assert.ok(html.includes("HTG / 1 USD"), "Should contain currency unit");
  });

  it("dispatches facts frameType to facts card", () => {
    const slide: IGStorySlide = {
      heading: "Repères du jour",
      eyebrow: "Ce matin",
      bullets: ["Fait 1", "Fait 2", "Fait 3"],
      accent: "#34d399",
      frameType: "facts",
    };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 1, 5);
    assert.ok(html.includes("Ce matin"), "Should contain facts eyebrow");
    assert.ok(html.includes("Repères du jour"), "Should contain facts title");
    assert.ok(html.includes("Fait 1"), "Should contain first fact");
    assert.ok(html.includes("Fait 3"), "Should contain third fact");
  });

  it("facts frames can use a background image without losing the editorial panel", () => {
    const slide: IGStorySlide = {
      heading: "Repères du jour",
      eyebrow: "Ce matin",
      bullets: ["Fait 1", "Fait 2"],
      backgroundImage: "https://example.com/facts.jpg",
      frameType: "facts",
    };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 1, 5);
    assert.ok(
      html.includes("facts.jpg"),
      "Should embed the facts background image",
    );
    assert.ok(
      html.includes("img-overlay"),
      "Should add an image overlay for readable contrast",
    );
    assert.ok(html.includes("panel"), "Should keep the editorial panel");
  });

  it("does not render story progress bars at the top", () => {
    const slide: IGStorySlide = {
      heading: "131.2589",
      bullets: ["13 mars 2026"],
      frameType: "taux",
    };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 0, 5);
    assert.ok(
      !html.includes("transition:width 0.2s"),
      "Should not render top progress markers",
    );
  });

  it("dispatches headline frameType to article summary card", () => {
    const slide: IGStorySlide = {
      heading: "Bourse UNESCO 2026",
      bullets: ["Résumé de l'article"],
      eyebrow: "BOURSE",
      subheading: "Résumé de l'article",
      meta: ["Date limite : 30 juin 2026"],
      footer: "Source: Le Nouvelliste",
      accent: "#3b82f6",
      frameType: "headline",
    };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 2, 5);
    assert.ok(html.includes("Bourse UNESCO 2026"), "Should contain headline");
    assert.ok(html.includes("BOURSE"), "Should contain eyebrow label");
    assert.ok(html.includes("30 juin 2026"), "Should contain metadata chip");
    assert.ok(html.includes("Le Nouvelliste"), "Should contain source");
  });

  it("headline frames still support legacy bullet/source fallback", () => {
    const slide: IGStorySlide = {
      heading: "Article test",
      bullets: ["Résumé de secours", "Source: AyiboPost"],
      frameType: "headline",
    };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 2, 5);
    assert.ok(
      html.includes("Résumé de secours"),
      "Should derive subheading from legacy bullets",
    );
    assert.ok(
      html.includes("AyiboPost"),
      "Should derive footer from legacy source bullet",
    );
  });

  it("legacy slides without frameType use positional fallback", () => {
    // Frame 0 should get cover layout
    const coverSlide: IGStorySlide = {
      heading: "Résumé du jour",
      bullets: ["3 actualités"],
    };
    const coverHtml = buildStorySlideHTML(coverSlide, "13 mars 2026", 0, 3);
    assert.ok(
      coverHtml.includes("Résumé du jour"),
      "Cover should render heading",
    );

    // Frame 1 should get headline layout
    const headlineSlide: IGStorySlide = {
      heading: "Article test",
      bullets: ["Résumé test"],
    };
    const headlineHtml = buildStorySlideHTML(
      headlineSlide,
      "13 mars 2026",
      1,
      3,
    );
    assert.ok(headlineHtml.includes("Article test"), "Headline should render");
  });

  it("CTA via frameType (not isCta flag)", () => {
    const slide: IGStorySlide = {
      heading: "",
      bullets: [],
      accent: "#14b8a6",
      frameType: "cta",
    };
    const html = buildStorySlideHTML(slide, "13 mars 2026", 5, 6, false);
    assert.ok(
      html.includes("@edlight.news"),
      "CTA via frameType should have handle",
    );
  });

  it("all frames have 1080×1920 dimensions", () => {
    const tauxSlide: IGStorySlide = {
      heading: "131.00",
      bullets: ["date"],
      frameType: "taux",
    };
    const factsSlide: IGStorySlide = {
      heading: "Facts",
      bullets: ["f1"],
      frameType: "facts",
    };
    const headlineSlide: IGStorySlide = {
      heading: "Headline",
      bullets: ["b1"],
      frameType: "headline",
    };

    for (const [label, slide, idx] of [
      ["taux", tauxSlide, 0],
      ["facts", factsSlide, 1],
      ["headline", headlineSlide, 2],
    ] as const) {
      const html = buildStorySlideHTML(slide, "test", idx, 4);
      assert.ok(
        html.includes("1080px"),
        `${label} frame should be 1080px wide`,
      );
      assert.ok(
        html.includes("1920px"),
        `${label} frame should be 1920px tall`,
      );
    }
  });
});
