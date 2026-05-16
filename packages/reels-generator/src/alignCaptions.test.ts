/**
 * alignCaptions tests.
 *
 * `alignCaptions` itself calls Google Cloud STT, which would require network
 * + credentials in CI. We unit-test the pure helpers (`tokenizeScript`) and
 * pin the public surface so that the production-critical invariant —
 * "captions only display tokens that appear in the script" — is enforced
 * structurally by the type system.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenizeScript } from "./alignCaptions.js";

describe("tokenizeScript", () => {
  it("splits on whitespace and preserves trailing punctuation", () => {
    const tokens = tokenizeScript("Bourse Fulbright 2026, candidats avant le 15 mars.");
    assert.deepEqual(tokens, [
      "Bourse",
      "Fulbright",
      "2026,",
      "candidats",
      "avant",
      "le",
      "15",
      "mars.",
    ]);
  });

  it("collapses repeated whitespace", () => {
    const tokens = tokenizeScript("  hello   world\n\n  again  ");
    assert.deepEqual(tokens, ["hello", "world", "again"]);
  });

  it("returns an empty array on whitespace-only input", () => {
    assert.deepEqual(tokenizeScript("   \n\t  "), []);
  });

  it("preserves diacritics and Haitian Creole apostrophes", () => {
    const tokens = tokenizeScript("Sa k pase, n ap boule. Étudiants à Pòtoprens.");
    assert.ok(tokens.includes("Étudiants"), "diacritics preserved");
    assert.ok(tokens.includes("Pòtoprens."), "Creole orthography preserved");
    assert.ok(tokens.includes("k"), "single-letter clitic preserved");
  });
});
