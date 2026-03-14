import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "@edlight-news/types";
import { isItemImageUsableForIG } from "./index.js";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    sourceId: "source-1",
    title: "Test item",
    summary: "Résumé de test",
    category: "news",
    geoTag: "HT",
    source: {
      name: "EdLight News",
      originalUrl: "https://example.com/story",
    },
    imageUrl: "https://example.com/image.png",
    ...overrides,
  } as Item;
}

describe("isItemImageUsableForIG", () => {
  it("rejects legacy branded landscape cards", () => {
    const item = makeItem({
      imageSource: "branded",
      imageMeta: { width: 1200, height: 630 },
    });

    assert.equal(isItemImageUsableForIG(item), false);
  });

  it("rejects images whose short side is below 1080px", () => {
    const item = makeItem({
      imageSource: "publisher",
      imageMeta: { width: 1600, height: 900 },
    });

    assert.equal(isItemImageUsableForIG(item), false);
  });

  it("rejects overly panoramic images", () => {
    const item = makeItem({
      imageSource: "publisher",
      imageMeta: { width: 2400, height: 900 },
    });

    assert.equal(isItemImageUsableForIG(item), false);
  });

  it("accepts high-resolution editorial images", () => {
    const item = makeItem({
      imageSource: "publisher",
      imageMeta: { width: 1600, height: 2000 },
    });

    assert.equal(isItemImageUsableForIG(item), true);
  });

  it("keeps unknown non-branded images for backwards compatibility", () => {
    const item = makeItem({
      imageSource: "publisher",
      imageMeta: undefined,
    });

    assert.equal(isItemImageUsableForIG(item), true);
  });
});