import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildUtilityCanonicalUrl,
  buildUtilityDedupeGroupId,
} from "./utility.js";

describe("utility daily canonical URLs", () => {
  it("creates a Haiti-date-bound canonical URL for daily fact/history series", () => {
    const date = new Date("2026-03-17T15:00:00Z");
    assert.equal(
      buildUtilityCanonicalUrl(
        "HaitiFactOfTheDay",
        "https://example.com/source",
        date,
      ),
      "edlight://utility/HaitiFactOfTheDay/2026-03-17",
    );
    assert.equal(
      buildUtilityCanonicalUrl(
        "HaitiHistory",
        "https://example.com/source",
        date,
      ),
      "edlight://utility/HaitiHistory/2026-03-17",
    );
  });

  it("changes the dedupe group across Haiti days for daily series", () => {
    const dayOne = buildUtilityDedupeGroupId(
      "HaitiFactOfTheDay",
      "Le saviez-vous ?",
      new Date("2026-03-17T15:00:00Z"),
    );
    const dayTwo = buildUtilityDedupeGroupId(
      "HaitiFactOfTheDay",
      "Le saviez-vous ?",
      new Date("2026-03-18T15:00:00Z"),
    );

    assert.notEqual(dayOne, dayTwo);
  });
});
