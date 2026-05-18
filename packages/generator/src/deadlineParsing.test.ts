import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDeadline, isDeadlinePast } from "./deadlineParsing.js";

const NOW = new Date(Date.UTC(2026, 4, 18)); // 2026-05-18 (Haiti reference day)

describe("parseDeadline", () => {
  it("parses ISO YYYY-MM-DD", () => {
    const d = parseDeadline("2026-03-15", NOW);
    assert.equal(d?.toISOString().slice(0, 10), "2026-03-15");
  });

  it("parses French free-text '15 mars 2026'", () => {
    const d = parseDeadline("15 mars 2026", NOW);
    assert.equal(d?.toISOString().slice(0, 10), "2026-03-15");
  });

  it("parses French with prefix 'Dépôt avant 15 mars 2026'", () => {
    const d = parseDeadline("Dépôt avant 15 mars 2026", NOW);
    assert.equal(d?.toISOString().slice(0, 10), "2026-03-15");
  });

  it("parses DD/MM/YYYY", () => {
    const d = parseDeadline("15/03/2026", NOW);
    assert.equal(d?.toISOString().slice(0, 10), "2026-03-15");
  });

  it("parses month-only by rolling forward when past", () => {
    // March already passed in May → expect March of NEXT year.
    const d = parseDeadline("15 mars", NOW);
    assert.equal(d?.toISOString().slice(0, 10), "2027-03-15");
  });

  it("parses English 'March 15, 2026'", () => {
    const d = parseDeadline("March 15, 2026", NOW);
    assert.equal(d?.toISOString().slice(0, 10), "2026-03-15");
  });

  it("returns null for empty / unparseable", () => {
    assert.equal(parseDeadline("", NOW), null);
    assert.equal(parseDeadline(null, NOW), null);
    assert.equal(parseDeadline("variable", NOW), null);
  });
});

describe("isDeadlinePast", () => {
  it("true for clearly past date", () => {
    assert.equal(isDeadlinePast("2026-03-15", NOW), true);
    assert.equal(isDeadlinePast("15 mars 2026", NOW), true);
  });

  it("false for future date", () => {
    assert.equal(isDeadlinePast("2099-01-01", NOW), false);
    assert.equal(isDeadlinePast("2026-12-31", NOW), false);
  });

  it("false for today (cutoff is end-of-day)", () => {
    assert.equal(isDeadlinePast("2026-05-18", NOW), false);
  });

  it("false (fail-open) for unparseable strings", () => {
    assert.equal(isDeadlinePast("rolling", NOW), false);
    assert.equal(isDeadlinePast(undefined, NOW), false);
    assert.equal(isDeadlinePast("", NOW), false);
  });
});
