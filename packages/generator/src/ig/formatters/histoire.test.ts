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

    const narrativeSlides = result.slides.slice(1);
    assert.ok(
      narrativeSlides.some((slide) => slide.layout === "headline"),
      "Expected at least one compact history beat to render as a headline slide",
    );
  });

  it("extracts a dedicated why-it-matters slide and keeps source attribution on the last slide", () => {
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
      result.slides.some((slide) =>
        /Pourquoi c'est important/i.test(slide.heading),
      ),
      "Expected a dedicated why-it-matters slide",
    );
    assert.match(
      result.slides[result.slides.length - 1]!.footer ?? "",
      /^Source:/,
    );
  });
});
