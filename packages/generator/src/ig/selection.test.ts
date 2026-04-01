/**
 * Tests for IG selection logic + priority scoring.
 *
 * Run with: npx tsx --test packages/generator/src/ig/selection.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideIG, applyDedupePenalty, isRoundupTitle } from "./selection.js";
import type { Item, QualityFlags } from "@edlight-news/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

const NOW_TS = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any;

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "test-item-1",
    rawItemId: "raw-1",
    sourceId: "src-1",
    title: "Test Scholarship for Haitian Students",
    summary: "A great scholarship opportunity for university students in Haiti.",
    canonicalUrl: "https://example.edu/scholarship",
    category: "scholarship",
    deadline: futureDate(10),
    evergreen: false,
    confidence: 0.9,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    },
    imageUrl: "https://example.com/hero.jpg",
    citations: [{ sourceName: "Example University", sourceUrl: "https://example.edu/scholarship" }],
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
    audienceFitScore: 0.8,
    source: {
      name: "Example University",
      originalUrl: "https://example.edu/scholarship",
    },
    opportunity: {
      deadline: futureDate(10),
      eligibility: ["Haitian students", "Undergraduate level"],
      coverage: "Full tuition + living expenses",
      howToApply: "Submit online application",
      officialLink: "https://example.edu/apply",
    },
    ...overrides,
  } as Item;
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0]!;
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0]!;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("decideIG", () => {
  it("marks scholarship with deadline + link as eligible", () => {
    const item = makeItem();
    const decision = decideIG(item);
    assert.equal(decision.igEligible, true);
    assert.equal(decision.igType, "scholarship");
    assert.ok(decision.igPriorityScore > 0);
  });

  it("assigns base score of 70 for scholarships", () => {
    const item = makeItem({ audienceFitScore: 0.35 });
    const decision = decideIG(item);
    assert.ok(decision.igPriorityScore >= 70, `Expected >= 70, got ${decision.igPriorityScore}`);
  });

  it("adds urgency bonus for deadline < 3 days", () => {
    const item = makeItem({ deadline: futureDate(2), opportunity: { ...makeItem().opportunity!, deadline: futureDate(2) } });
    const decision = decideIG(item);
    const reasons = decision.reasons.join(" ");
    assert.ok(reasons.includes("<3 days"), "Should include urgency reason for <3 days");
    assert.ok(decision.igPriorityScore >= 95, `Expected >= 95 with urgency, got ${decision.igPriorityScore}`);
  });

  it("adds urgency bonus for deadline 3-7 days", () => {
    const item = makeItem({ deadline: futureDate(5) });
    const decision = decideIG(item);
    const reasons = decision.reasons.join(" ");
    assert.ok(reasons.includes("3-7 days"), "Should include urgency reason for 3-7 days");
  });

  it("rejects scholarship without deadline (non-evergreen)", () => {
    const item = makeItem({ deadline: null, opportunity: { ...makeItem().opportunity!, deadline: undefined } });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false);
    assert.ok(decision.reasons.some((r) => r.includes("missing deadline")));
  });

  it("rejects item with past deadline", () => {
    const item = makeItem({ deadline: pastDate(5), opportunity: { ...makeItem().opportunity!, deadline: pastDate(5) } });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false);
    assert.ok(decision.reasons.some((r) => r.includes("passed")));
  });

  it("rejects off-mission items", () => {
    const item = makeItem({
      qualityFlags: { hasSourceUrl: true, needsReview: false, lowConfidence: false, offMission: true, reasons: ["off-mission"] },
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false);
  });

  it("rejects news with low audience fit and no markers", () => {
    const item = makeItem({
      category: "news",
      title: "Political debate continues",
      summary: "Government officials discuss policy changes.",
      extractedText: Array(250).fill("debate").join(" "),
      audienceFitScore: 0.2,
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false);
    assert.ok(decision.reasons.some((r) => r.includes("low audience fit")));
  });

  it("accepts news with high audience fit and student markers", () => {
    const item = makeItem({
      category: "news",
      title: "Université d'État announce examen baccalauréat schedule",
      summary: "Les étudiants doivent s'inscrire pour les examens de l'université.",
      extractedText: Array(250).fill("éducation université examen étudiant").join(" "),
      audienceFitScore: 0.7,
      deadline: null,
      opportunity: undefined,
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, true);
    assert.equal(decision.igType, "news");
    assert.ok(decision.igPriorityScore >= 45);
  });

  it("maps opportunity categories correctly", () => {
    const item = makeItem({ category: "opportunity" });
    const decision = decideIG(item);
    assert.equal(decision.igType, "opportunity");
  });

  it("maps utility items to histoire when series is HaitiHistory", () => {
    const item = makeItem({
      category: "resource",
      itemType: "utility",
      utilityMeta: {
        series: "HaitiHistory",
        utilityType: "history",
        citations: [
          {
            label: "La Révolution Haïtienne de 1791 et l'Indépendance de 1804",
            url: "https://britannica.com/topic/haitian-revolution",
          },
        ],
      },
      deadline: null,
      opportunity: undefined,
    });
    const decision = decideIG(item);
    assert.equal(decision.igType, "histoire");
    assert.equal(decision.igEligible, true);
  });

  it("demotes HaitiHistory utility items with non-historical content to news", () => {
    const item = makeItem({
      category: "resource",
      itemType: "utility",
      utilityMeta: {
        series: "HaitiHistory",
        utilityType: "history",
        citations: [
          {
            label: "Prix Théâtre RFI 2026 — appel à candidatures",
            url: "https://alterpresse.org/article-2026",
          },
        ],
      },
      deadline: null,
      opportunity: undefined,
    });
    const decision = decideIG(item);
    assert.equal(decision.igType, "news");
  });

  it("adds official source bonus", () => {
    const item = makeItem({
      source: { name: "MENFP", originalUrl: "https://menfp.gouv.ht/scholarships" },
    });
    const decision = decideIG(item);
    assert.ok(decision.reasons.some((r) => r.includes("Official source")));
  });

  it("applies weak source penalty", () => {
    const item = makeItem({
      qualityFlags: {
        hasSourceUrl: true,
        needsReview: false,
        lowConfidence: false,
        weakSource: true,
        reasons: ["weak source"],
      },
    });
    const decision = decideIG(item);
    assert.ok(decision.reasons.some((r) => r.includes("Weak source")));
  });

  it("clamps score to 0..100", () => {
    // Very high score scenario
    const item = makeItem({
      deadline: futureDate(1),
      audienceFitScore: 1.0,
      source: { name: "MENFP", originalUrl: "https://menfp.gouv.ht/test" },
    });
    const decision = decideIG(item);
    assert.ok(decision.igPriorityScore <= 100, `Score should be <= 100, got ${decision.igPriorityScore}`);
    assert.ok(decision.igPriorityScore >= 0, `Score should be >= 0, got ${decision.igPriorityScore}`);
  });

  it("rejects items with no canonical URL", () => {
    const item = makeItem({
      canonicalUrl: "",
      source: undefined,
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false);
    assert.ok(decision.reasons.some((r) => r.includes("Missing source URL")));
  });
});

describe("applyDedupePenalty", () => {
  it("reduces score by 20 when dedupe group was recently posted", () => {
    const item = makeItem();
    const decision = decideIG(item);
    const originalScore = decision.igPriorityScore;

    const recentGroupIds = new Set(["group-1"]);
    const penalized = applyDedupePenalty(decision, recentGroupIds, "group-1");

    assert.equal(penalized.igPriorityScore, Math.max(0, originalScore - 20));
    assert.ok(penalized.reasons.some((r) => r.includes("Dedupe group")));
  });

  it("does not penalize when group was not recently posted", () => {
    const item = makeItem();
    const decision = decideIG(item);
    const originalScore = decision.igPriorityScore;

    const recentGroupIds = new Set(["group-other"]);
    const result = applyDedupePenalty(decision, recentGroupIds, "group-1");

    assert.equal(result.igPriorityScore, originalScore);
  });

  it("does not penalize ineligible items", () => {
    const decision = {
      igEligible: false,
      igType: null as any,
      igPriorityScore: 0,
      reasons: ["Not eligible"],
    };
    const result = applyDedupePenalty(decision, new Set(["group-1"]), "group-1");
    assert.equal(result.igPriorityScore, 0);
  });
});

// ── Roundup blocklist tests ─────────────────────────────────────────────

describe("isRoundupTitle", () => {
  it("blocks 'Actualités Haïti' roundup titles", () => {
    assert.equal(isRoundupTitle("Actualités Haïti"), true);
    assert.equal(isRoundupTitle("Actualités Haiti — 13 mars 2026"), true);
    assert.equal(isRoundupTitle("actualites haiti du jour"), true);
  });

  it("blocks 'Résumé de l'actualité' titles", () => {
    assert.equal(isRoundupTitle("Résumé de l'actualité du 12 mars"), true);
    assert.equal(isRoundupTitle("Résumé des nouvelles — semaine 10"), true);
    assert.equal(isRoundupTitle("Resume du jour"), true);
  });

  it("blocks 'Les nouvelles du jour' and similar", () => {
    assert.equal(isRoundupTitle("Les nouvelles du jour"), true);
    assert.equal(isRoundupTitle("Les nouvelles en bref — 13 mars"), true);
  });

  it("blocks 'Revue de presse' and 'Tour d'horizon'", () => {
    assert.equal(isRoundupTitle("Revue de presse — mars 2026"), true);
    assert.equal(isRoundupTitle("Tour d'horizon de la semaine"), true);
  });

  it("blocks 'Haïti en bref'", () => {
    assert.equal(isRoundupTitle("Haïti en bref — 13 mars 2026"), true);
    assert.equal(isRoundupTitle("Haiti actualités — ce qu'il faut savoir"), true);
  });

  it("blocks 'Flash info' and 'Points saillants'", () => {
    assert.equal(isRoundupTitle("Flash info du 12 mars 2026"), true);
    assert.equal(isRoundupTitle("Points saillants de la semaine"), true);
  });

  it("blocks 'Nouvelles du [weekday]' Juno7 pattern", () => {
    assert.equal(isRoundupTitle("Nouvelles du lundi 10 mars"), true);
    assert.equal(isRoundupTitle("Nouvelles du vendredi"), true);
  });

  it("blocks 'Ce qu'il faut retenir'", () => {
    assert.equal(isRoundupTitle("Ce qu'il faut retenir de ce jeudi 13 mars"), true);
  });

  it("allows specific topic titles (not roundups)", () => {
    assert.equal(isRoundupTitle("Le Fonds Canadien lance un programme de bourses"), false);
    assert.equal(isRoundupTitle("Haïti : le gouvernement annonce des réformes éducatives"), false);
    assert.equal(isRoundupTitle("Bourse UNESCO 2026 — appel à candidatures"), false);
    assert.equal(isRoundupTitle("Enregistrement des partis politiques avant la date limite"), false);
    assert.equal(isRoundupTitle("Taux du jour — BRH"), false);
  });

  it("handles empty / null title", () => {
    assert.equal(isRoundupTitle(""), false);
  });
});

describe("decideIG — roundup gate", () => {
  it("rejects news article with roundup title", () => {
    const item = makeItem({
      category: "news",
      title: "Actualités Haïti — 13 mars 2026",
      summary: "Résumé des principales nouvelles du jour en Haïti incluant économie et politique.",
      extractedText: Array(250).fill("mot").join(" "), // passes thin-content gate (200+ words)
      audienceFitScore: 0.8,
      deadline: null,
      opportunity: undefined,
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false);
    assert.ok(decision.reasons.some((r) => r.includes("Roundup")));
  });

  it("allows news article with specific topic title", () => {
    const item = makeItem({
      category: "news",
      title: "Le gouvernement haïtien lance un programme de bourses universitaires",
      summary: "Le Ministère de l'Éducation annonce un nouveau programme de bourses pour les étudiants haïtiens.",
      extractedText: Array(250).fill("mot").join(" "),
      audienceFitScore: 0.8,
      deadline: null,
      opportunity: undefined,
    });
    const decision = decideIG(item);
    // Should pass roundup gate (may fail other gates, but not the roundup one)
    assert.ok(!decision.reasons.some((r) => r.includes("Roundup")));
  });
});

describe("decideIG — imageConfidence boundary", () => {
  it("rejects items with imageConfidence exactly 0.4 (screenshots)", () => {
    const item = makeItem({
      imageConfidence: 0.4,
      imageUrl: "https://example.com/screenshot.png",
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false);
    assert.ok(decision.reasons.some((r) => r.includes("imageConfidence")));
  });

  it("accepts items with imageConfidence > 0.4", () => {
    const item = makeItem({
      imageConfidence: 0.5,
      imageUrl: "https://example.com/photo.jpg",
    });
    const decision = decideIG(item);
    assert.ok(!decision.reasons.some((r) => r.includes("imageConfidence")));
  });
});
