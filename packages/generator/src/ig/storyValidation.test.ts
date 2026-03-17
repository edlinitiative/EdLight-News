import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { IGStoryPayload } from "@edlight-news/types";
import { validateStoryPayloadForPublishing } from "./storyValidation.js";

function makePayload(overrides: Partial<IGStoryPayload> = {}): IGStoryPayload {
  return {
    dateLabel: "17 mars 2026",
    slides: [
      {
        heading: "131.20",
        bullets: ["17 mars 2026", "Achat: 130.90"],
        frameType: "taux",
      },
      {
        heading: "Repères du jour",
        bullets: [
          "Le MENFP a confirmé un nouveau calendrier d'inscription pour les élèves concernés.",
        ],
        frameType: "facts",
      },
    ],
    ...overrides,
  };
}

describe("validateStoryPayloadForPublishing", () => {
  it("accepts a clean multi-frame morning briefing", () => {
    const result = validateStoryPayloadForPublishing(makePayload());

    assert.equal(result.shouldHold, false);
    assert.equal(result.issues.length, 0);
  });

  it("holds a story that is too thin to feel editorial", () => {
    const result = validateStoryPayloadForPublishing({
      dateLabel: "17 mars 2026",
      slides: [
        {
          heading: "Résumé du jour",
          bullets: ["Aucune actualité aujourd'hui"],
          frameType: "cover",
        },
      ],
    });

    assert.equal(result.shouldHold, true);
    assert.ok(
      result.issues.some((issue) => /Story trop mince/i.test(issue.message)),
    );
  });

  it("holds obviously truncated story prose", () => {
    const result = validateStoryPayloadForPublishing({
      dateLabel: "17 mars 2026",
      slides: [
        {
          heading: "Repères du jour",
          bullets: [
            "Cette réforme a changé l'organisation des examens dans plusieurs écoles et fait désormais de la.",
          ],
          frameType: "facts",
        },
        {
          heading: "Ce qu'il faut retenir",
          bullets: ["Le ministère promet un calendrier plus clair pour les directions."],
          frameType: "facts",
        },
      ],
    });

    assert.equal(result.shouldHold, true);
    assert.ok(
      result.issues.some((issue) => /probablement tronqué/i.test(issue.message)),
    );
  });

  it("holds story copy that still appears to be in English", () => {
    const result = validateStoryPayloadForPublishing({
      dateLabel: "17 mars 2026",
      slides: [
        {
          heading: "Scholarship update",
          bullets: ["Applicants must submit the application form online this week."],
          frameType: "headline",
        },
        {
          heading: "Repères du jour",
          bullets: ["Le ministère publiera la version finale demain."],
          frameType: "facts",
        },
      ],
    });

    assert.equal(result.shouldHold, true);
    assert.ok(
      result.issues.some((issue) => /anglais/i.test(issue.message)),
    );
  });
});
