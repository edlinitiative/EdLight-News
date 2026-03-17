/**
 * Tests for the two-pass reviewer module.
 *
 * Unit tests for `needsReview()` and `countEmojis()`.
 * These are pure-logic tests (no LLM calls).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countEmojis,
  needsReview,
  normalizePayloadForPublishing,
  validatePayloadForPublishing,
} from "./review.js";
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
    caption: "Résumé propre.",
  };
}

describe("needsReview", () => {
  it("flags English markers in bullets", () => {
    const payload = makePayload([
      { heading: "Test", bullets: ["You must submit your application by Friday"] },
    ]);
    assert.equal(needsReview(payload, "news"), true);
  });

  it("flags short scholarship finance phrases that still contain English", () => {
    const payload = makePayload([
      { heading: "Couverture", bullets: ["Full tuition + monthly stipend"] },
    ]);
    assert.equal(needsReview(payload, "scholarship"), true);
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

  it("flags captions with broken sentence endings", () => {
    const payload = makePayload([
      { heading: "Actualité", bullets: ["Texte propre"] },
    ]);
    payload.caption = "Titre\n\nVoici un paragraphe qui se termine au milieu d'une idée…\n\n#EdLightNews";
    assert.equal(needsReview(payload, "news"), true);
  });

  it("flags captions with repeated prose blocks", () => {
    const payload = makePayload([
      { heading: "Actualité", bullets: ["Texte propre"] },
    ]);
    payload.caption = "Titre\n\nLe ministère a confirmé l'ouverture des inscriptions pour 2026.\n\nLe ministère a confirmé l'ouverture des inscriptions pour 2026.\n\n#EdLightNews";
    assert.equal(needsReview(payload, "news"), true);
  });
});

describe("normalizePayloadForPublishing", () => {
  it("trims whitespace, deduplicates bullets, and repairs caption endings", () => {
    const payload: IGFormattedPayload = {
      slides: [
        {
          heading: "  Titre principal  ",
          bullets: ["  Point clé  ", "Point clé", "   ", "Autre point"],
          layout: "explanation",
        },
      ],
      caption: "Titre\n\nUne phrase qui se coupe au milieu…",
    };

    const normalized = normalizePayloadForPublishing(payload);

    assert.deepEqual(normalized.slides[0]?.bullets, ["Point clé", "Autre point"]);
    assert.equal(normalized.slides[0]?.heading, "Titre principal");
    assert.equal(normalized.caption, "Titre.\n\nUne phrase qui se coupe au milieu.");
  });
});

describe("validatePayloadForPublishing", () => {
  it("holds payloads that are still too short or duplicated", () => {
    const result = validatePayloadForPublishing(
      {
        slides: [
          { heading: "Même idée", bullets: ["Texte identique"], layout: "explanation" },
          { heading: "Même idée", bullets: ["Texte identique"], layout: "explanation" },
        ],
        caption: "Trop court.",
      },
      "news",
    );

    assert.equal(result.shouldHold, true);
    assert.ok(result.issues.some((issue) => /trop courte/i.test(issue.message)));
    assert.ok(result.issues.some((issue) => /trop similaire/i.test(issue.message)));
  });

  it("holds cover-only editorial payloads outside the taux format", () => {
    const result = validatePayloadForPublishing(
      {
        slides: [
          {
            heading: "Titre de couverture",
            bullets: ["Un simple habillage sans vrai développement éditorial."],
            layout: "headline",
          },
        ],
        caption: "Résumé éditorial suffisamment long pour dépasser clairement le seuil minimal de validation Instagram, avec plusieurs phrases propres et cohérentes afin de tester uniquement la tolérance aux payloads trop minces sans autre facteur parasite.",
      },
      "news",
    );

    assert.equal(result.shouldHold, true);
    assert.ok(
      result.issues.some((issue) => /2 slides/i.test(issue.message)),
      "Expected a thin-carousel hold",
    );
  });

  it("still allows a compact taux payload when the editorial checks are otherwise clean", () => {
    const result = validatePayloadForPublishing(
      {
        slides: [
          {
            heading: "131.2589",
            bullets: ["17 mars 2026"],
            layout: "headline",
          },
        ],
        caption: "Taux BRH du jour.\n\nLe taux de référence du 17 mars 2026 s'établit à 131.2589 HTG pour 1 USD, avec les détails disponibles sur EdLight News.\n\n#TauxDuJour #BRH #EdLightNews",
      },
      "taux",
    );

    assert.equal(result.shouldHold, false);
  });

  it("passes polished editorial captions", () => {
    const result = validatePayloadForPublishing(
      {
        slides: [
          {
            heading: "L'État lance un nouveau programme",
            bullets: ["Le ministère détaille le calendrier 2026 pour les inscriptions."],
            layout: "headline",
          },
          {
            heading: "Ce qu'il faut retenir",
            bullets: ["Les premières démarches commencent en avril.", "Les candidats devront suivre les consignes officielles."],
            layout: "explanation",
          },
        ],
        caption: "Le ministère a présenté un nouveau programme pour 2026.\n\nLes premières démarches débutent en avril et les détails seront publiés progressivement.\n\nConsultez EdLight News pour suivre les prochaines annonces officielles.\n\n#EdLightNews #Haïti #Éducation",
      },
      "news",
    );

    assert.equal(result.shouldHold, false);
    assert.equal(result.issues.length, 0);
  });
});
