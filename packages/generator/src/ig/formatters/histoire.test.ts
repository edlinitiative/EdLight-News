import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "@edlight-news/types";
import { buildHistoireCarousel } from "./histoire.js";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "history-item-1",
    title: "Cinq dates clés de l'histoire d'Haïti",
    summary: "Cinq événements fondateurs de la nation haïtienne.",
    canonicalUrl: "https://example.com/histoire",
    category: "news",
    itemType: "source",
    status: "published",
    locale: "fr",
    publishedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    utilityMeta: {
      series: "HaitiHistory",
      utilityType: "history",
      citations: [{ label: "Britannica", url: "https://britannica.com" }],
    } as any,
    ...overrides,
  } as Item;
}

describe("buildHistoireCarousel", () => {
  it("uses a date+year cover heading with the main event as a single bullet", () => {
    const result = buildHistoireCarousel(
      makeItem({
        publishedAt: {
          seconds: Date.parse("2026-04-24T12:00:00.000Z") / 1000,
          nanoseconds: 0,
        } as any,
      }),
      {
        frTitle: "Repères du 24 avril",
        frSummary: "Deux faits marquants de l'histoire haïtienne.",
        frSections: [
          {
            heading: "Retrait stratégique de la Crête-à-Pierrot",
            content:
              "En 1802, les forces haïtiennes se retirent de la Crête-à-Pierrot après une résistance prolongée face à l'expédition française.",
          },
          {
            heading: "Assassinat de Jean-Jacques Dessalines",
            content:
              "Le 17 octobre 1806, Jean-Jacques Dessalines est assassiné à Pont-Rouge dans un contexte de fortes rivalités politiques.",
          },
        ],
      },
    );

    // Cover heading: "24 Avril" + year extracted from main event content ("1802")
    assert.equal(result.slides[0]!.heading, "24 Avril 1802");
    // Cover bullet: first sentence of the main event content (not a noun phrase)
    assert.deepEqual(result.slides[0]!.bullets, [
      "En 1802, les forces haïtiennes se retirent de la Crête-à-Pierrot après une résistance prolongée face à l'expédition française.",
    ]);
    // "Other facts" slide lists the second event before the CTA
    const otherFactsSlide = result.slides.find(
      (s) => s.heading.startsWith("Aussi le"),
    );
    assert.ok(otherFactsSlide, "Expected an 'other facts' slide");
    assert.ok(
      otherFactsSlide!.bullets.some((b) =>
        b.includes("Dessalines est assassiné"),
      ),
      "Expected second event to appear in the other-facts slide as a sentence",
    );
  });

  it("synthesises a narrative arc from section content when frNarrative is absent", () => {
    const result = buildHistoireCarousel(makeItem(), {
      frTitle: "Cinq dates clés de l'histoire d'Haïti",
      frSummary: "Cinq événements fondateurs de la nation haïtienne.",
      frSections: [
        {
          heading: "Bois Caïman (1791)",
          content:
            "La cérémonie vaudou du Bois Caïman a lancé la plus grande révolte d'esclaves réussie de l'histoire. Cette nuit du 14 août 1791 est considérée comme le point de départ de la révolution haïtienne.",
        },
        {
          heading: "Bataille de Vertières (1803)",
          content:
            "Les forces haïtiennes ont vaincu l'armée de Napoléon lors de cette bataille décisive.",
        },
        {
          heading: "Indépendance (1804)",
          content:
            "Haïti devient la première république noire indépendante au monde.",
        },
      ],
    });

    // Content slides (between cover and CTA) should exist and use explanation layout
    const contentSlides = result.slides.slice(1, -1).filter(
      (s) => !s.heading.startsWith("Aussi le"),
    );
    assert.ok(contentSlides.length > 0, "Expected at least one content slide");
    assert.ok(
      contentSlides.every((s) => s.layout === "explanation"),
      "Expected all narrative content slides to use explanation layout",
    );
  });

  it("skips why-it-matters framing and ends on a premium closing slide", () => {
    const result = buildHistoireCarousel(
      makeItem({ title: "L'indépendance d'Haïti (1804)" }),
      {
        frTitle: "L'indépendance d'Haïti (1804)",
        frSummary: "Haïti devient la première république noire indépendante.",
        frSections: [
          {
            heading: "L'indépendance d'Haïti (1804)",
            content:
              "Le 1er janvier 1804, Jean-Jacques Dessalines proclame l'indépendance d'Haïti à Gonaïves.\n\n💡 **Pour les étudiants :** Cette victoire a redéfini la notion de liberté universelle et a inspiré des mouvements de libération dans toute l'Amérique latine.\n\n📚 Sources : [Wikipedia](https://fr.wikipedia.org/wiki/Haiti)",
          },
        ],
      },
    );

    assert.ok(
      !result.slides.some((slide) =>
        /Pourquoi c'est important/i.test(slide.heading),
      ),
      "Did not expect a dedicated why-it-matters slide",
    );
    assert.equal(
      result.slides[result.slides.length - 1]!.heading,
      "Suivez-nous pour plus de repères historiques",
    );
    assert.deepEqual(result.slides[result.slides.length - 1]!.bullets, [
      "L'histoire d'Haïti, chaque jour.",
    ]);
    assert.equal(result.slides[result.slides.length - 1]!.layout, "cta");
    assert.equal(
      result.slides[result.slides.length - 1]!.footer,
      undefined,
      "CTA slide should have no footer — source belongs in the caption only",
    );
    assert.ok(
      result.caption.includes(
        "Suivez EdLight News pour d'autres repères historiques.",
      ),
      "Expected the premium history CTA in the caption",
    );
  });

  it("caption bullets are complete sentences, not bare noun-phrase headings", () => {
    // Regression guard: section headings like "Nomination de Toussaint Louverture"
    // are noun phrases and must NEVER appear as caption bullets — only the summary
    // sentences from section content should be used.
    const result = buildHistoireCarousel(makeItem(), {
      frTitle: "Repères du 27 mars",
      frSummary: "Trois moments clés de l'histoire haïtienne.",
      frSections: [
        {
          heading: "Nomination de Toussaint Louverture",
          content:
            "En 1796, Toussaint Louverture fut nommé général en chef de l'armée par les commissaires français, consolidant son pouvoir sur la colonie.",
        },
        {
          heading: "Retrait de la Crête-à-Pierrot",
          content:
            "En 1802, les troupes haïtiennes se retirèrent de la Crête-à-Pierrot après trois semaines de résistance face à l'armée napoléonienne.",
        },
      ],
    });

    const captionLines = result.caption.split("\n").filter((l) => l.startsWith("•"));

    // Every bullet must end with sentence-closing punctuation.
    for (const line of captionLines) {
      assert.match(
        line,
        /[.!?»]$/,
        `Caption bullet is not a complete sentence: "${line}"`,
      );
    }

    // The bare noun phrases from headings must not appear verbatim as bullets.
    assert.ok(
      !result.caption.includes("• Nomination de Toussaint Louverture"),
      'Bare heading "Nomination de Toussaint Louverture" must not appear as a caption bullet',
    );
    assert.ok(
      !result.caption.includes("• Retrait de la Crête-à-Pierrot"),
      'Bare heading "Retrait de la Crête-à-Pierrot" must not appear as a caption bullet',
    );

    // No bullet may contain a duplicate year prefix ("1796 — En 1796, ...").
    for (const line of captionLines) {
      const yearMatch = line.match(/^\u2022\s*(\d{4})\s*\u2014/);
      if (yearMatch) {
        const prefixYear = yearMatch[1]!;
        const rest = line.slice(line.indexOf("\u2014") + 1);
        assert.ok(
          !rest.includes(prefixYear),
          `Caption bullet has duplicate year "${prefixYear}": "${line}"`,
        );
      }
    }
  });

  it("builds the caption lead from the full summary instead of a shortened cover bullet", () => {
    const result = buildHistoireCarousel(
      makeItem({
        title: "1er janvier 1804 – Haïti proclame son indépendance",
        summary:
          "Le 1er janvier 1804, Jean-Jacques Dessalines proclame l'indépendance d'Haïti à Gonaïves, faisant de la nation la première république noire libre au monde et le deuxième pays indépendant des Amériques.",
        extractedText:
          "La cérémonie a eu lieu à la place d'Armes de Gonaïves. L'acte d'indépendance fut rédigé par Boisrond-Tonnerre.",
      }),
    );

    assert.ok(
      result.caption.includes("faisant de la nation la première république noire libre au monde"),
      "Expected the caption to preserve the full summary thought",
    );
    assert.ok(
      !result.caption.includes("faisant de la."),
      "Expected the caption to avoid the broken shortened cover-bullet ending",
    );
  });
});
