import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "@edlight-news/types";
import { extractTargetPostDate } from "./buildIgQueue.js";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "queue-item",
    title: "Repère quotidien",
    summary: "Résumé",
    canonicalUrl: "https://example.com/source",
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

describe("extractTargetPostDate", () => {
  it("parses date-bound utility canonical URLs for daily fact posts", () => {
    const item = makeItem({
      canonicalUrl: "edlight://utility/HaitiFactOfTheDay/2026-03-17",
      utilityMeta: { series: "HaitiFactOfTheDay" } as any,
    });

    assert.equal(extractTargetPostDate(item), "2026-03-17");
  });

  it("falls back to the Haiti-local createdAt date for legacy daily utility items", () => {
    const item = makeItem({
      createdAt: {
        seconds: Math.floor(new Date("2026-03-17T15:00:00Z").getTime() / 1000),
        nanoseconds: 0,
      } as any,
      utilityMeta: { series: "HaitiFactOfTheDay" } as any,
    });

    assert.equal(extractTargetPostDate(item), "2026-03-17");
  });
});
