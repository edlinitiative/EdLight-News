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

  it("assigns base score of 72 for opportunities (higher priority than scholarships)", () => {
    // Use minimal audienceFitScore (0.35) to pass Haiti-relevance gate.
    // Use a deadline far in the future (30 days) to avoid urgency bonuses.
    // Set canonicalUrl to a non-official domain to avoid official source bonus.
    // Clear source to avoid official source check.
    // Base(72) + audience(5) = 77.
    const item = makeItem({
      category: "opportunity",
      deadline: futureDate(30),
      audienceFitScore: 0.35,
      source: undefined,
      canonicalUrl: "https://example.com/test",
      opportunity: { ...makeItem().opportunity!, deadline: futureDate(30) },
    });
    const decision = decideIG(item);
    assert.equal(decision.igPriorityScore, 77, `Expected 77 for opportunity (72 base + 5 audience), got ${decision.igPriorityScore}`);
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
    assert.ok(decision.igPriorityScore >= 40);
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

describe("source locality tier bonus", () => {
  function makeNewsItem(overrides: Partial<Item> = {}): Item {
    return makeItem({
      category: "news",
      title: "Université d'État annonce examen baccalauréat",
      summary: "Les étudiants doivent s'inscrire pour les examens.",
      extractedText: Array(250).fill("éducation université examen étudiant").join(" "),
      audienceFitScore: 0.7,
      deadline: null,
      opportunity: undefined,
      qualityFlags: { hasSourceUrl: true, needsReview: false, lowConfidence: false, reasons: [] },
      ...overrides,
    });
  }

  it("gives local Haitian news a +15 bonus", () => {
    const item = makeNewsItem({
      canonicalUrl: "https://lenouvelliste.com/article/123",
      source: { name: "Le Nouvelliste", originalUrl: "https://lenouvelliste.com/article/123" },
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, true);
    assert.ok(
      decision.reasons.some((r) => r.includes("Local Haitian source: +15")),
      `Expected local-source bonus, got reasons: ${decision.reasons.join(" | ")}`,
    );
  });

  it("penalizes international news with -5", () => {
    const item = makeNewsItem({
      canonicalUrl: "https://www.rfi.fr/fr/ameriques/haiti-article",
      source: { name: "RFI", originalUrl: "https://www.rfi.fr/fr/ameriques/haiti-article" },
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, true);
    assert.ok(
      decision.reasons.some((r) => r.includes("International source: -5")),
      `Expected international penalty, got reasons: ${decision.reasons.join(" | ")}`,
    );
  });

  it("scores local news higher than international news for the same content", () => {
    const local = decideIG(makeNewsItem({
      canonicalUrl: "https://juno7.ht/article/123",
      source: { name: "Juno7", originalUrl: "https://juno7.ht/article/123" },
    }));
    const intl = decideIG(makeNewsItem({
      canonicalUrl: "https://www.france24.com/fr/ameriques/haiti-article",
      source: { name: "France 24", originalUrl: "https://www.france24.com/fr/ameriques/haiti-article" },
    }));
    assert.equal(local.igEligible, true);
    assert.equal(intl.igEligible, true);
    // Local should beat international by ~20 (15 + 5 swing) for identical content
    assert.ok(
      local.igPriorityScore - intl.igPriorityScore >= 15,
      `Expected local to outrank international by ≥15, got local=${local.igPriorityScore} intl=${intl.igPriorityScore}`,
    );
  });

  it("does NOT apply tier bonus to scholarships (international scholarships are valid)", () => {
    const item = makeItem({
      canonicalUrl: "https://www.campusfrance.org/fr/bourses-haiti",
      source: { name: "Campus France", originalUrl: "https://www.campusfrance.org/fr/bourses-haiti" },
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, true);
    assert.equal(decision.igType, "scholarship");
    assert.ok(
      !decision.reasons.some((r) => r.includes("source: -5") || r.includes("source: +15")),
      `Scholarships should be exempt from tier bonus, got: ${decision.reasons.join(" | ")}`,
    );
  });
});

describe("applyDedupePenalty", () => {
  it("hard-blocks (sets ineligible) when dedupe group was recently posted", () => {
    const item = makeItem();
    const decision = decideIG(item);
    assert.equal(decision.igEligible, true);

    const recentGroupIds = new Set(["group-1"]);
    const penalized = applyDedupePenalty(decision, recentGroupIds, "group-1");

    assert.equal(penalized.igEligible, false);
    assert.equal(penalized.igPriorityScore, 0);
    assert.ok(penalized.reasons.some((r) => r.includes("hard block")));
  });

  it("does not block when group was not recently posted", () => {
    const item = makeItem();
    const decision = decideIG(item);
    const originalScore = decision.igPriorityScore;

    const recentGroupIds = new Set(["group-other"]);
    const result = applyDedupePenalty(decision, recentGroupIds, "group-1");

    assert.equal(result.igEligible, true);
    assert.equal(result.igPriorityScore, originalScore);
  });

  it("is a no-op for already-ineligible items", () => {
    const decision = {
      igEligible: false,
      igType: null as any,
      igPriorityScore: 0,
      reasons: ["Not eligible"],
    };
    const result = applyDedupePenalty(decision, new Set(["group-1"]), "group-1");
    assert.equal(result.igEligible, false);
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

describe("decideIG — scholarship eligibility gate", () => {
  it("rejects scholarship when opportunity.eligibility is empty array", () => {
    // Before the fix, discoverScholarships could write eligibility=[] which caused
    // hasRealOpportunityFields() to silently downgrade to "news" (then fail thin-content).
    const item = makeItem({
      opportunity: {
        ...makeItem().opportunity!,
        eligibility: [],
      },
    });
    const decision = decideIG(item);
    // Must NOT route as scholarship — downgraded to news (which then fails other gates)
    assert.notEqual(decision.igType, "scholarship", "Empty eligibility should not produce scholarship type");
  });

  it("accepts scholarship when eligibility defaults to [\"HT\"]", () => {
    // discoverScholarships now writes eligibility=["HT"] as a fallback when
    // the LLM doesn't return explicit countries. This must pass hasRealOpportunityFields().
    const item = makeItem({
      opportunity: {
        ...makeItem().opportunity!,
        eligibility: ["HT"],
      },
    });
    const decision = decideIG(item);
    assert.equal(decision.igType, "scholarship");
    assert.equal(decision.igEligible, true);
  });

  it("accepts scholarship when eligibility contains country codes alongside HT", () => {
    const item = makeItem({
      opportunity: {
        ...makeItem().opportunity!,
        eligibility: ["HT", "Global", "Toutes nationalités"],
      },
    });
    const decision = decideIG(item);
    assert.equal(decision.igType, "scholarship");
    assert.equal(decision.igEligible, true);
  });

  it("rejects scholarship with eligibility that explicitly excludes Haiti (Africa-only)", () => {
    const item = makeItem({
      title: "Africa Scholarship for Sub-Saharan Students",
      summary: "A scholarship exclusively for sub-Saharan African students.",
      extractedText: Array(100).fill("sub-saharan african students only").join(" "),
      opportunity: {
        ...makeItem().opportunity!,
        eligibility: ["sub-saharan africa", "kenya", "nigeria", "ghana"],
      },
      audienceFitScore: 0.3,
    });
    const decision = decideIG(item);
    assert.equal(decision.igEligible, false, "Africa-only scholarship should be rejected");
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
