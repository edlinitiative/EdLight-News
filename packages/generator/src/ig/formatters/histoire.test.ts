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
  it("uses a date-led Histoire du Jour cover with factual event bullets", () => {
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

    assert.equal(result.slides[0]!.heading, "24 Avril - Histoire du Jour");
    assert.deepEqual(result.slides[0]!.bullets, [
      "Retrait stratégique de la Crête-à-Pierrot",
      "Assassinat de Jean-Jacques Dessalines",
    ]);
  });

  it("turns compact historical beats into headline slides instead of dense explanation cards", () => {
    const result = buildHistoireCarousel(makeItem(), {
      frTitle: "Cinq dates clés de l'histoire d'Haïti",
      frSummary: "Cinq événements fondateurs de la nation haïtienne.",
      frSections: [
        {
          heading: "Bois Caïman (1791)",
          content:
            "La cérémonie vaudou du Bois Caïman a lancé la plus grande révolte d'esclaves réussie de l'histoire.",
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

    const narrativeSlides = result.slides.slice(1, -1);
    assert.ok(
      narrativeSlides.some((slide) => slide.layout === "headline"),
      "Expected at least one compact history beat to render as a headline slide",
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
      "Pour aller plus loin",
    );
    assert.deepEqual(result.slides[result.slides.length - 1]!.bullets, [
      "Suivez EdLight News pour d'autres repères historiques.",
    ]);
    assert.match(
      result.slides[result.slides.length - 1]!.footer ?? "",
      /^Source:/,
    );
    assert.ok(
      result.caption.includes(
        "Suivez EdLight News pour d'autres repères historiques.",
      ),
      "Expected the premium history CTA in the caption",
    );
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
