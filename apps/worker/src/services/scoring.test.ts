import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildItemSource, computeScoring } from "./scoring.js";

describe("computeScoring geoTag", () => {
  it("classifies a normal Google News Haiti headline as HT, not Diaspora", () => {
    const result = computeScoring(
      "Haiti announces new school calendar",
      "Students in Port-au-Prince will follow the updated exam schedule.",
      "news",
    );

    assert.equal(result.geoTag, "HT");
    assert.ok(result.audienceFitScore > 0);
  });

  it("does not infer Diaspora from a single Haiti mention", () => {
    const result = computeScoring(
      "UN discusses education funding for Haiti",
      "The update mentions scholarship support for students.",
      "news",
    );

    assert.equal(result.geoTag, "HT");
  });

  it("uses Diaspora only when diaspora context is explicit", () => {
    const result = computeScoring(
      "Haitian-American students launch scholarship fund in Miami",
      "The diaspora initiative supports Haitian students applying to college.",
      "news",
    );

    assert.equal(result.geoTag, "Diaspora");
  });

  it("does not infer Diaspora from diaspora-adjacent locations alone", () => {
    const result = computeScoring(
      "Miami university announces new research program",
      "Students can apply for education funding this fall.",
      "news",
    );

    assert.equal(result.geoTag, "Global");
  });
});

describe("buildItemSource", () => {
  it("treats a real Google News publisher URL as the original source", () => {
    const { source, weakSource } = buildItemSource(
      "Miami Herald",
      "https://www.miamiherald.com/news/nation-world/world/americas/haiti/article123.html",
    );

    assert.equal(source.name, "Miami Herald");
    assert.equal(source.originalUrl, "https://www.miamiherald.com/news/nation-world/world/americas/haiti/article123.html");
    assert.equal(source.aggregatorUrl, undefined);
    assert.equal(weakSource, false);
  });
});
