import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "@edlight-news/types";
import { buildFactLine } from "./buildIgStory.js";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "story-fact-item",
    title: "Repère du jour",
    summary: "Résumé court.",
    canonicalUrl: "https://example.com/fact",
    category: "utility",
    itemType: "utility",
    status: "published",
    locale: "fr",
    publishedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    ...overrides,
  } as Item;
}

describe("buildFactLine", () => {
  it("keeps longer fact copy instead of cutting at the old short character ceiling", () => {
    const summary =
      "Ce repère du jour explique en une seule phrase complète pourquoi la réforme a changé le parcours des élèves concernés, comment elle s'applique dans les écoles visées, et ce qu'il faut retenir pour comprendre l'annonce sans avoir une coupure brutale après seulement quelques lignes.";
    const factLine = buildFactLine(makeItem({ summary }));

    assert.ok(factLine, "Expected a fact line");
    assert.ok(
      factLine!.length > 220,
      `Expected the fact line to survive past the old hard limit, got ${factLine!.length}`,
    );
    assert.ok(
      factLine!.includes("réforme a changé"),
      "Expected the preserved fact line to keep the main sentence",
    );
  });
});
