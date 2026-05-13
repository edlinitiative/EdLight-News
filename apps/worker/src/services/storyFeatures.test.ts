import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  featuresForTopic,
  pickStoryFeatures,
  type StoryFeatureTopic,
} from "./storyFeatures.js";

const URL = "https://news.edlight.org/article/123";

describe("featuresForTopic — per-topic shape contract", () => {
  it("scholarship → article link + Postule CTA", () => {
    assert.deepEqual(featuresForTopic("scholarship", URL), {
      linkUrl: URL,
      ctaText: "Postule",
    });
  });

  it("opportunity → article link + Postule CTA", () => {
    assert.deepEqual(featuresForTopic("opportunity", URL), {
      linkUrl: URL,
      ctaText: "Postule",
    });
  });

  it("taux → daily-habit poll, no link sticker", () => {
    const f = featuresForTopic("taux", URL);
    assert.equal(f.linkUrl, undefined);
    assert.equal(f.pollQuestion, "Ou swiv to a chak jou?");
    assert.deepEqual(f.pollOptions, ["Wi", "Pa vrèman"]);
  });

  it("utility → same daily-habit poll as taux", () => {
    assert.deepEqual(featuresForTopic("utility", URL), featuresForTopic("taux", URL));
  });

  it("news → article link + Li plis CTA", () => {
    assert.deepEqual(featuresForTopic("news", URL), {
      linkUrl: URL,
      ctaText: "Li plis",
    });
  });

  it("histoire → article link + Li plis CTA", () => {
    assert.deepEqual(featuresForTopic("histoire", URL), {
      linkUrl: URL,
      ctaText: "Li plis",
    });
  });

  it("default (undefined topic) → bare link only", () => {
    assert.deepEqual(featuresForTopic(undefined, URL), { linkUrl: URL });
  });
});

describe("pickStoryFeatures — priority resolver", () => {
  it("empty briefing → bare link default", () => {
    assert.deepEqual(pickStoryFeatures([], URL), { linkUrl: URL });
  });

  it("scholarship-only briefing → Postule CTA", () => {
    assert.deepEqual(pickStoryFeatures(["scholarship"], URL), {
      linkUrl: URL,
      ctaText: "Postule",
    });
  });

  it("taux beats scholarship (priority 1)", () => {
    const f = pickStoryFeatures(["scholarship", "taux"], URL);
    assert.equal(f.pollQuestion, "Ou swiv to a chak jou?");
    assert.equal(f.linkUrl, undefined);
  });

  it("utility beats scholarship when taux absent", () => {
    const f = pickStoryFeatures(["scholarship", "utility"], URL);
    assert.equal(f.pollQuestion, "Ou swiv to a chak jou?");
  });

  it("scholarship beats opportunity, news, histoire", () => {
    const f = pickStoryFeatures(["histoire", "news", "opportunity", "scholarship"], URL);
    assert.equal(f.ctaText, "Postule");
    assert.equal(f.linkUrl, URL);
  });

  it("news beats histoire", () => {
    const f = pickStoryFeatures(["histoire", "news"], URL);
    assert.equal(f.ctaText, "Li plis");
  });

  it("histoire-only briefing → Li plis CTA", () => {
    assert.deepEqual(pickStoryFeatures(["histoire"], URL), {
      linkUrl: URL,
      ctaText: "Li plis",
    });
  });

  it("all six topics present → taux wins (highest priority)", () => {
    const all: StoryFeatureTopic[] = [
      "scholarship",
      "opportunity",
      "taux",
      "utility",
      "news",
      "histoire",
    ];
    const f = pickStoryFeatures(all, URL);
    assert.equal(f.pollQuestion, "Ou swiv to a chak jou?");
    assert.equal(f.linkUrl, undefined);
  });

  it("duplicate topics in present[] are tolerated", () => {
    const f = pickStoryFeatures(["scholarship", "scholarship", "scholarship"], URL);
    assert.equal(f.ctaText, "Postule");
  });
});
