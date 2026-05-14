/**
 * @edlight-news/generator — Wider opportunity taxonomy regression tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  inferOpportunityKind,
  inferOpportunityAudience,
  inferFundingType,
  inferLocationType,
  inferHaitiEligibility,
  inferOpportunityLifecycle,
  inferTrustTier,
  kindToBroadCategory,
} from "./opportunityTaxonomy.js";

describe("inferOpportunityKind", () => {
  it("detects fellowship over generic scholarship", () => {
    assert.equal(
      inferOpportunityKind("Schwarzman Scholars Fellowship — applications open for 2026"),
      "fellowship",
    );
  });
  it("detects hackathon", () => {
    assert.equal(inferOpportunityKind("Caribbean Climate Hackathon 2026"), "hackathon");
  });
  it("detects leadership program", () => {
    assert.equal(
      inferOpportunityKind("Mandela Washington Fellowship for Young African Leaders 2026"),
      "leadership_program",
    );
  });
  it("detects accelerator", () => {
    assert.equal(
      inferOpportunityKind("Y Combinator Winter 2026 batch — applications open"),
      "accelerator",
    );
  });
  it("detects youth delegation", () => {
    assert.equal(
      inferOpportunityKind("UNGA Youth Delegates programme — call for applications"),
      "youth_delegation",
    );
  });
  it("detects scholarship for a generic Fulbright story", () => {
    assert.equal(
      inferOpportunityKind("Bourse Fulbright pour étudiants haïtiens"),
      "scholarship",
    );
  });
  it("falls back to call_for_applications when no specific kind matches", () => {
    assert.equal(
      inferOpportunityKind("Appel à candidatures 2026 ouvert"),
      "call_for_applications",
    );
  });
  it("returns null when nothing matches", () => {
    assert.equal(inferOpportunityKind("Le gouvernement annonce une réforme."), null);
  });
});

describe("inferOpportunityAudience", () => {
  it("detects high school + university for an essay contest", () => {
    const aud = inferOpportunityAudience(
      "International essay contest open to high school and undergraduate students",
    );
    assert.ok(aud.includes("high_school"));
    assert.ok(aud.includes("university"));
  });
  it("detects entrepreneur for startup programmes", () => {
    const aud = inferOpportunityAudience(
      "Startup accelerator for early-stage founders and entrepreneurs",
    );
    assert.ok(aud.includes("entrepreneur"));
  });
  it("returns empty array when no audience signal present", () => {
    assert.deepEqual(inferOpportunityAudience("Random news article."), []);
  });
});

describe("inferFundingType", () => {
  it("detects fully funded", () => {
    assert.equal(
      inferFundingType("Fully-funded MasterCard Foundation Scholarship"),
      "fully_funded",
    );
  });
  it("detects paid for stage rémunéré", () => {
    assert.equal(inferFundingType("Stage rémunéré chez UNESCO"), "paid");
  });
  it("detects free training", () => {
    assert.equal(
      inferFundingType("Formation gratuite en programmation pour jeunes haïtiens"),
      "free",
    );
  });
  it("returns unclear when no funding signal", () => {
    assert.equal(inferFundingType("Programme de leadership 2026"), "unclear");
  });
});

describe("inferLocationType", () => {
  it("detects online", () => {
    assert.equal(inferLocationType("100% online cohort"), "online");
  });
  it("detects hybrid", () => {
    assert.equal(inferLocationType("Hybrid program with in-person and online sessions"), "hybrid");
  });
});

describe("inferHaitiEligibility", () => {
  it("returns yes when Haiti is mentioned", () => {
    assert.equal(
      inferHaitiEligibility("Open to applicants from Haiti and the Caribbean"),
      "yes",
    );
  });
  it("returns yes for francophone / global", () => {
    assert.equal(
      inferHaitiEligibility("Open globally to all nationalities"),
      "yes",
    );
  });
  it("returns unclear when no signal", () => {
    assert.equal(inferHaitiEligibility("Programme details TBA"), "unclear");
  });
});

describe("inferOpportunityLifecycle", () => {
  const now = new Date("2026-05-14T00:00:00Z");
  it("returns expired for past deadlines", () => {
    assert.equal(inferOpportunityLifecycle("2026-01-01", now), "expired");
  });
  it("returns deadline_soon for next 14 days", () => {
    assert.equal(inferOpportunityLifecycle("2026-05-20", now), "deadline_soon");
  });
  it("returns open for far-future deadlines", () => {
    assert.equal(inferOpportunityLifecycle("2026-10-15", now), "open");
  });
  it("returns unknown when no deadline", () => {
    assert.equal(inferOpportunityLifecycle(null, now), "unknown");
    assert.equal(inferOpportunityLifecycle(undefined, now), "unknown");
  });
});

describe("inferTrustTier", () => {
  it("returns official for fulbright.org", () => {
    assert.equal(inferTrustTier("Fulbright Program", "https://fulbright.org/x"), "official");
  });
  it("returns aggregator for opportunitydesk.org", () => {
    assert.equal(
      inferTrustTier("Opportunity Desk", "https://opportunitydesk.org/x"),
      "aggregator",
    );
  });
  it("returns social for instagram", () => {
    assert.equal(inferTrustTier("EdLight IG", "https://instagram.com/x"), "social");
  });
  it("falls back to media", () => {
    assert.equal(inferTrustTier("Le Nouvelliste", "https://lenouvelliste.com"), "media");
  });
});

describe("kindToBroadCategory", () => {
  it("maps fellowship → bourses", () => {
    assert.equal(kindToBroadCategory("fellowship"), "bourses");
  });
  it("maps hackathon → concours", () => {
    assert.equal(kindToBroadCategory("hackathon"), "concours");
  });
  it("maps leadership_program → programmes", () => {
    assert.equal(kindToBroadCategory("leadership_program"), "programmes");
  });
  it("maps internship → stages", () => {
    assert.equal(kindToBroadCategory("internship"), "stages");
  });
});
