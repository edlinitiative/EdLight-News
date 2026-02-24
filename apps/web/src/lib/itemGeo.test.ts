import { describe, it, expect } from "vitest";
import { getItemGeo, isStudentFocused } from "./itemGeo";
import type { ItemGeoInput } from "./itemGeo";

// ── Helper to build a minimal item ──────────────────────────────────────────

function item(overrides: Partial<ItemGeoInput> & { title: string }): ItemGeoInput {
  const { title, ...rest } = overrides;
  return { title, ...rest };
}

// ── getItemGeo ──────────────────────────────────────────────────────────────

describe("getItemGeo", () => {
  // ── Rule 1: Explicit geoTag / country ─────────────────────────────────

  it('returns "Haiti" when geoTag is "HT"', () => {
    expect(getItemGeo(item({ title: "Random title", geoTag: "HT" }))).toBe(
      "Haiti",
    );
  });

  it('returns "Haiti" when geoTag is "Haiti" (case-insensitive)', () => {
    expect(
      getItemGeo(item({ title: "Anything", geoTag: "Haiti" })),
    ).toBe("Haiti");
  });

  it('returns "International" when geoTag is "INTL"', () => {
    expect(
      getItemGeo(item({ title: "Scholarships in Mexico", geoTag: "INTL" })),
    ).toBe("International");
  });

  it('returns "International" when geoTag is unrecognized (e.g. "Diaspora")', () => {
    expect(
      getItemGeo(item({ title: "Diaspora news", geoTag: "Diaspora" })),
    ).toBe("International");
  });

  it('returns "Haiti" when country is "HT"', () => {
    expect(
      getItemGeo(item({ title: "Education reforms", country: "HT" })),
    ).toBe("Haiti");
  });

  it('returns "International" when country is "MX"', () => {
    expect(
      getItemGeo(item({ title: "Mexican scholarships", country: "MX" })),
    ).toBe("International");
  });

  // ── Rule 2: Source domain inference ───────────────────────────────────

  it('returns "Haiti" when source domain is menfp.gouv.ht', () => {
    expect(
      getItemGeo(
        item({
          title: "Calendrier scolaire 2026",
          sources: [{ url: "https://menfp.gouv.ht/calendrier", name: "MENFP" }],
        }),
      ),
    ).toBe("Haiti");
  });

  it('returns "Haiti" when source domain ends with .ht', () => {
    expect(
      getItemGeo(
        item({
          title: "Nouvelles locales",
          sources: [{ url: "https://example.edu.ht/article" }],
        }),
      ),
    ).toBe("Haiti");
  });

  // ── Rule 3: Haiti keywords ───────────────────────────────────────────

  it('returns "Haiti" when title contains "Port-au-Prince"', () => {
    expect(
      getItemGeo(item({ title: "Manifestation à Port-au-Prince" })),
    ).toBe("Haiti");
  });

  it('returns "Haiti" when summary mentions "Jacmel"', () => {
    expect(
      getItemGeo(
        item({ title: "Festival artistique", summary: "Événement à Jacmel cette semaine." }),
      ),
    ).toBe("Haiti");
  });

  it('returns "Haiti" when title mentions "Haïti"', () => {
    expect(
      getItemGeo(item({ title: "Haïti: Nouvelles réformes éducatives" })),
    ).toBe("Haiti");
  });

  // ── Rule 4: Explicit non-Haiti country → International ───────────────

  it('returns "International" for Mexico-only title', () => {
    expect(
      getItemGeo(item({ title: "Bourses au Mexique pour étudiants" })),
    ).toBe("International");
  });

  it('returns "International" when title mentions "Canada" with no Haiti signal', () => {
    expect(
      getItemGeo(item({ title: "Étudier au Canada: guide complet" })),
    ).toBe("International");
  });

  it('returns "International" when title mentions "France"', () => {
    expect(
      getItemGeo(item({ title: "Bourses du gouvernement de France" })),
    ).toBe("International");
  });

  it('returns "Haiti" when title mentions both Mexico and Haiti', () => {
    // Haiti keyword takes precedence (rule 3 before rule 4)
    expect(
      getItemGeo(
        item({ title: "Mexique et Haïti: coopération éducative" }),
      ),
    ).toBe("Haiti");
  });

  // ── Rule 5: Fallback → Unknown ───────────────────────────────────────

  it('returns "Unknown" when there are no signals', () => {
    expect(
      getItemGeo(item({ title: "Nouvelles opportunités de bourse" })),
    ).toBe("Unknown");
  });
});

// ── isStudentFocused ────────────────────────────────────────────────────────

describe("isStudentFocused", () => {
  it("returns true for MENFP mention", () => {
    expect(isStudentFocused({ title: "MENFP annonce le calendrier" })).toBe(
      true,
    );
  });

  it("returns true for university keyword in summary", () => {
    expect(
      isStudentFocused({
        title: "Rentrée scolaire",
        summary: "L'université ouvre ses portes en septembre.",
      }),
    ).toBe(true);
  });

  it("returns false for general news", () => {
    expect(
      isStudentFocused({ title: "Crise politique dans la capitale" }),
    ).toBe(false);
  });
});
