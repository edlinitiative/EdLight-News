import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import type { Scholarship } from "@edlight-news/types";
import { serializeOpportunityForApply } from "./serializeOpportunityForApply";

/** Build a minimally-valid Scholarship for use in tests. */
function makeScholarship(overrides: Partial<Scholarship> = {}): Scholarship {
  return {
    id: "abc123",
    name: "Test Programme",
    country: "HT",
    level: ["master"],
    fundingType: "full",
    officialUrl: "https://example.com",
    sources: [],
    verifiedAt: Timestamp.fromDate(new Date("2026-01-15T00:00:00Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-04-20T00:00:00Z")),
    ...overrides,
  } as Scholarship;
}

describe("serializeOpportunityForApply", () => {
  it("maps the happy-path fields", () => {
    const dto = serializeOpportunityForApply(
      makeScholarship({
        kind: "program",
        haitianEligibility: "yes",
        eligibleCountries: ["HT", "Global"],
        deadline: { dateISO: "2026-09-01", sourceUrl: "https://example.com/d" },
        deadlineAccuracy: "exact",
        howToApplyUrl: "https://example.com/apply",
        requirements: ["passport", "transcript"],
        eligibilitySummary: "Open to Haitian students.",
        relatedPagePath: "/uwc-haiti",
        tags: ["scholarship", "ht"],
      }),
    );

    expect(dto.id).toBe("abc123");
    expect(dto.title).toBe("Test Programme");
    expect(dto.type).toBe("program");
    expect(dto.summary).toBe("Open to Haitian students.");
    expect(dto.countries).toEqual(["HT"]);
    expect(dto.eligibleNationalities).toEqual(["HT", "Global"]);
    expect(dto.haitiEligibilityStatus).toBe("yes");
    expect(dto.degreeLevels).toEqual(["master"]);
    expect(dto.fundingType).toBe("full");
    expect(dto.deadline).toBe("2026-09-01");
    expect(dto.deadlineConfidence).toBe("exact");
    expect(dto.applicationUrl).toBe("https://example.com/apply");
    expect(dto.sourceUrl).toBe("https://example.com");
    expect(dto.documentsRequired).toEqual(["passport", "transcript"]);
    expect(dto.publicNewsUrl).toBe("/uwc-haiti");
    expect(dto.tags).toEqual(["scholarship", "ht"]);
    expect(dto.verificationStatus).toBe("verified");
    expect(dto.lastCheckedAt).toBe("2026-01-15T00:00:00.000Z");
    expect(dto.updatedAt).toBe("2026-04-20T00:00:00.000Z");
  });

  it("falls back applicationUrl → officialUrl when howToApplyUrl is absent", () => {
    const dto = serializeOpportunityForApply(makeScholarship());
    expect(dto.applicationUrl).toBe("https://example.com");
  });

  it("returns null/[] for missing optional fields without inventing data", () => {
    const dto = serializeOpportunityForApply(makeScholarship());
    expect(dto.slug).toBeNull();
    expect(dto.fields).toEqual([]);
    expect(dto.languages).toEqual([]);
    expect(dto.fundingDetails).toBeNull();
    expect(dto.requiresAdmissionFirst).toBeNull();
    expect(dto.languageTestsAccepted).toEqual([]);
    expect(dto.deadline).toBeNull();
    expect(dto.eligibleNationalities).toEqual([]);
    expect(dto.documentsRequired).toEqual([]);
    expect(dto.tags).toEqual([]);
    expect(dto.publicNewsUrl).toBeNull();
    expect(dto.createdAt).toBeNull();
  });

  it("normalises unknown enum values to 'unknown'", () => {
    const dto = serializeOpportunityForApply(
      makeScholarship({
        kind: undefined,
        haitianEligibility: undefined,
        fundingType: "unknown",
        deadlineAccuracy: undefined,
      }),
    );
    expect(dto.type).toBe("unknown");
    expect(dto.haitiEligibilityStatus).toBe("unknown");
    expect(dto.fundingType).toBe("unknown");
    expect(dto.deadlineConfidence).toBe("unknown");
  });

  it("uses programDescription as summary fallback when eligibilitySummary is absent", () => {
    const dto = serializeOpportunityForApply(
      makeScholarship({ programDescription: "A long description." }),
    );
    expect(dto.summary).toBe("A long description.");
  });

  it("treats a missing verifiedAt as unverified", () => {
    const dto = serializeOpportunityForApply(
      // verifiedAt is a required Timestamp on Scholarship, but Firestore docs
      // can be missing it in practice for partial writes — simulate that.
      makeScholarship({ verifiedAt: undefined as unknown as Timestamp }),
    );
    expect(dto.verificationStatus).toBe("unverified");
    expect(dto.lastCheckedAt).toBeNull();
  });

  it("accepts plain {seconds} timestamps and ISO strings", () => {
    const dto = serializeOpportunityForApply(
      makeScholarship({
        verifiedAt: { seconds: 1_700_000_000, nanoseconds: 0 } as unknown as Timestamp,
        updatedAt: "2026-05-01T12:00:00Z" as unknown as Timestamp,
      }),
    );
    expect(dto.lastCheckedAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(dto.updatedAt).toBe("2026-05-01T12:00:00Z");
  });
});
