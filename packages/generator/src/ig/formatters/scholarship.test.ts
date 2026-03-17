import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "@edlight-news/types";
import { buildScholarshipCarousel } from "./scholarship.js";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "scholarship-item-1",
    title: "Bourse de la Banque mondiale",
    summary: "Programme de bourse destiné aux étudiants haïtiens.",
    canonicalUrl: "https://example.com/scholarship",
    category: "scholarship",
    itemType: "source",
    status: "published",
    locale: "fr",
    publishedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    opportunity: {
      eligibility: ["Être étudiant haïtien"],
    } as any,
    ...overrides,
  } as Item;
}

describe("buildScholarshipCarousel", () => {
  it("sanitizes mixed English scholarship fields before publishing", () => {
    const result = buildScholarshipCarousel(
      makeItem({
        title: "Bourse Banque mondiale 2026",
        summary:
          "Scholarship for students from developing countries with full tuition and monthly stipend.",
        deadline: "2026-04-15",
        opportunity: {
          deadline: "2026-04-15",
          eligibility: [
            "Must be a citizen of a developing country eligible for World Bank funding",
            "Applicants should have at least 3 years of professional experience",
          ],
          coverage: "Full tuition + monthly stipend",
          howToApply:
            "Submit your application form online through the World Bank scholarship portal",
          officialLink: "https://www.worldbank.org/scholarships",
        } as any,
      }),
      {
        frTitle: "Bourse Banque mondiale 2026",
        frSummary:
          "Scholarship for students from developing countries with full tuition and monthly stipend.",
      },
    );

    const combinedText = [
      ...result.slides.flatMap((slide) => [slide.heading, ...slide.bullets]),
      result.caption,
    ].join(" ");

    assert.ok(
      !/\b(?:scholarship|applicants|submit|stipend|portal|website|students)\b/i.test(combinedText),
      `Expected scholarship payload to stay French-only, got: ${combinedText}`,
    );

    assert.ok(
      result.slides[0]?.bullets.some((bullet) => /Couverture/i.test(bullet)),
      "Expected cover slide to expose a French coverage line",
    );
  });

  it("falls back to a French scholarship summary when the source summary stays English", () => {
    const result = buildScholarshipCarousel(
      makeItem({
        summary:
          "Scholarship for students with strong leadership and academic merit.",
      }),
      {
        frTitle: "Bourse de leadership académique",
        frSummary:
          "Scholarship for students with strong leadership and academic merit.",
      },
    );

    const summarySlide = result.slides.find((slide) => slide.heading === "De quoi s'agit-il ?");
    assert.ok(summarySlide, "Expected summary slide");
    assert.equal(
      summarySlide?.bullets[0],
      "Programme de bourse à consulter sur le site officiel pour les détails complets.",
    );
  });
});
