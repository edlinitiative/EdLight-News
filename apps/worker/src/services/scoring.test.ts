import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildItemSource, computeScoring, isMajorWorldNews } from "./scoring.js";

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

describe("isMajorWorldNews", () => {
  it("admits a major-power presidential election", () => {
    assert.equal(
      isMajorWorldNews(
        "US presidential election: results roll in across swing states",
        "Voters cast ballots nationwide.",
      ),
      true,
    );
  });

  it("admits war / armed conflict", () => {
    assert.equal(
      isMajorWorldNews("La guerre s'intensifie à la frontière", "..."),
      true,
    );
  });

  it("admits a scientific breakthrough", () => {
    assert.equal(
      isMajorWorldNews("Scientific breakthrough: new malaria vaccine approved", "..."),
      true,
    );
  });

  it("rejects routine world sports", () => {
    assert.equal(
      isMajorWorldNews(
        "USA vs Belgium — FIFA World Cup 2026 round of 16",
        "The match kicks off at 8pm.",
      ),
      false,
    );
  });

  it("rejects celebrity/entertainment trivia", () => {
    assert.equal(
      isMajorWorldNews(
        "Taylor Swift and Travis Kelce marry in New York",
        "The couple celebrated with friends and family.",
      ),
      false,
    );
  });

  it("requires a title hit, not just a passing body mention", () => {
    assert.equal(
      isMajorWorldNews(
        "Local festival draws a crowd",
        "One attendee mentioned the pandemic in passing.",
      ),
      false,
    );
  });
});
