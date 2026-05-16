/**
 * Hero-number extraction tests. These pin the salience hierarchy:
 *
 *   currency (100) > deadline (90) > count (75) > percentage (60) > year (5)
 *
 * The whole point of this module — and of `pickTemplateWithDowngrade` — is
 * to make sure a bare year like "2026" never lands as the hero number on a
 * scholarship reel, which is what produced the v1.0 regression.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractHeroNumber,
  HERO_NUMBER_SALIENCE,
  type HeroNumberSource,
} from "./extractHeroNumber.js";

describe("extractHeroNumber", () => {
  it("ranks currency above all other kinds", () => {
    const src: HeroNumberSource = {
      title: "Bourse Fulbright 2026",
      summary: "Bourses jusqu'à $5,000 USD pour 25 candidats avant le 15 mars 2026.",
    };
    const hero = extractHeroNumber(src);
    if (!hero) throw new Error("expected a hero number");
    assert.equal(hero.kind, "currency");
    assert.match(hero.value, /\$|USD|5/);
    assert.equal(hero.salience, HERO_NUMBER_SALIENCE.currency);
  });

  it("falls back to deadline when no currency is mentioned", () => {
    const src: HeroNumberSource = {
      title: "Bourse Fulbright 2026",
      summary: "25 places disponibles. Date limite : 15 mars 2026.",
    };
    const hero = extractHeroNumber(src);
    if (!hero) throw new Error("expected a hero number");
    assert.equal(hero.kind, "deadline");
    assert.match(hero.value, /15|mars|2026/);
  });

  it("picks count over a bare year", () => {
    const src: HeroNumberSource = {
      title: "Lancement programme 2026",
      summary: "200 lauréats sélectionnés cette année.",
    };
    const hero = extractHeroNumber(src);
    if (!hero) throw new Error("expected a hero number");
    assert.equal(hero.kind, "count");
    assert.match(hero.value, /200/);
  });

  it("picks percentage over a bare year", () => {
    const src: HeroNumberSource = {
      title: "Rapport annuel 2026",
      summary: "Le taux de réussite atteint 87% cette année.",
    };
    const hero = extractHeroNumber(src);
    if (!hero) throw new Error("expected a hero number");
    assert.equal(hero.kind, "percentage");
    assert.match(hero.value, /87/);
  });

  it("returns null when only a bare year is present and no other number is salient", () => {
    // The whole point of pickTemplateWithDowngrade — when only "2026"
    // appears, we either get a year-kind hero (and downgrade off
    // BigStatistic) or null. Either way the orchestrator must NOT
    // promote "2026" as the hero text.
    const src: HeroNumberSource = {
      title: "Rétrospective 2026",
      summary: "Une année de transformation pour le pays.",
    };
    const hero = extractHeroNumber(src);
    if (hero !== null) {
      assert.equal(hero.kind, "year", `unexpected non-year hero: ${JSON.stringify(hero)}`);
    }
  });

  it("respects structured hints with a +5 salience boost", () => {
    const src: HeroNumberSource = {
      title: "Bourse",
      summary: "Bourses Fulbright.",
      structured: { amount_usd: 12000 },
    };
    const hero = extractHeroNumber(src);
    if (!hero) throw new Error("expected a hero number");
    assert.equal(hero.kind, "currency");
    assert.equal(hero.salience, HERO_NUMBER_SALIENCE.currency + 5);
  });

  it("returns null on text with no numbers at all", () => {
    const src: HeroNumberSource = {
      title: "Ouverture du programme",
      summary: "Le programme accueille de nouveaux candidats.",
    };
    assert.equal(extractHeroNumber(src), null);
  });
});
