/**
 * Unit tests for the editorial normalization engine.
 *
 * Run: npx tsx --test packages/generator/src/normalize.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildNormalizePrompt,
  geminiNormalizedArticleSchema,
  validateNormalizationGrounding,
  formatNormalizedArticle,
} from "./normalize.js";
import type {
  NormalizeArticleInput,
  GeminiNormalizedArticle,
} from "./normalize.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_INPUT: NormalizeArticleInput = {
  title: "Haïti: une situation CHOQUANTE dans les écoles!!!",
  body: `Le ministère de l'Éducation nationale a annoncé le 15 février 2026 que 250 écoles dans le département du Sud seront rénovées grâce à un financement de 12 000 000 USD de la Banque mondiale. Le ministre Jean-Pierre Ducasse a déclaré : « Ce programme représente un investissement historique dans l'avenir de nos enfants. » Les travaux devraient commencer en avril 2026. Le nombre exact d'élèves bénéficiaires n'a pas encore été confirmé. La répartition par commune reste à déterminer.`,
  sourceName: "Le Nouvelliste",
  sourceUrl: "https://lenouvelliste.com/article/123456",
};

const VALID_OUTPUT: GeminiNormalizedArticle = {
  title: "Haïti : 250 écoles du Sud seront rénovées avec un financement de la Banque mondiale",
  executive_summary:
    "Le ministère de l'Éducation a annoncé la rénovation de 250 écoles dans le département du Sud. Le financement de 12 millions USD provient de la Banque mondiale. Les travaux sont prévus pour avril 2026.",
  confirmed_facts:
    "Le 15 février 2026, le ministère de l'Éducation nationale a annoncé un programme de rénovation couvrant 250 écoles dans le département du Sud. Le financement s'élève à 12 000 000 USD, accordé par la Banque mondiale. Les travaux devraient débuter en avril 2026.",
  official_statements:
    'Le ministre de l\'Éducation Jean-Pierre Ducasse a déclaré : « Ce programme représente un investissement historique dans l\'avenir de nos enfants. »',
  unclear_points:
    "Le nombre exact d'élèves bénéficiaires n'a pas été communiqué. La répartition des 250 écoles par commune n'est pas précisée.",
  why_it_matters:
    "Ce programme de rénovation pourrait améliorer les conditions d'apprentissage dans l'un des départements les plus touchés par le déficit d'infrastructures scolaires. Pour les étudiants du Sud, cela pourrait signifier un accès à des salles de classe conformes aux normes minimales.",
  source_citation: "Le Nouvelliste — https://lenouvelliste.com/article/123456",
  information_to_verify:
    "Nombre d'élèves bénéficiaires. Répartition par commune. Calendrier détaillé des travaux.",
  confidence: 0.92,
};

// ── 1. Prompt builder ───────────────────────────────────────────────────────

describe("buildNormalizePrompt", () => {
  it("includes the article title in the prompt", () => {
    const prompt = buildNormalizePrompt(SAMPLE_INPUT);
    assert.ok(prompt.includes(SAMPLE_INPUT.title));
  });

  it("includes the source name and URL", () => {
    const prompt = buildNormalizePrompt(SAMPLE_INPUT);
    assert.ok(prompt.includes("Le Nouvelliste"));
    assert.ok(prompt.includes("https://lenouvelliste.com/article/123456"));
  });

  it("defaults to French when lang is not specified", () => {
    const prompt = buildNormalizePrompt(SAMPLE_INPUT);
    assert.ok(prompt.includes("français"));
  });

  it("switches to Kreyòl when lang=ht", () => {
    const prompt = buildNormalizePrompt({ ...SAMPLE_INPUT, lang: "ht" });
    assert.ok(prompt.includes("kreyòl ayisyen"));
  });

  it("includes all mandatory editorial rules", () => {
    const prompt = buildNormalizePrompt(SAMPLE_INPUT);
    assert.ok(prompt.includes("NE PAS inventer de faits"));
    assert.ok(prompt.includes("NE PAS ajouter de spéculation"));
    assert.ok(prompt.includes("NE PAS supprimer les attributions"));
    assert.ok(prompt.includes("NE PAS changer le sens"));
  });

  it("includes banned phrases", () => {
    const prompt = buildNormalizePrompt(SAMPLE_INPUT);
    assert.ok(prompt.includes("Cela soulève des questions"));
    assert.ok(prompt.includes("La population s'interroge"));
    assert.ok(prompt.includes("Une situation préoccupante"));
  });

  it("truncates body at 8000 chars", () => {
    const longBody = "A".repeat(10000);
    const prompt = buildNormalizePrompt({ ...SAMPLE_INPUT, body: longBody });
    // Body in prompt should be truncated
    const bodyOccurrences = prompt.split("A".repeat(8000));
    assert.ok(bodyOccurrences.length >= 2, "Body should contain exactly 8000 A's");
    assert.ok(!prompt.includes("A".repeat(8001)), "Body should not contain 8001 A's");
  });
});

// ── 2. Zod schema validation ────────────────────────────────────────────────

describe("geminiNormalizedArticleSchema", () => {
  it("accepts a valid normalized article", () => {
    const result = geminiNormalizedArticleSchema.safeParse(VALID_OUTPUT);
    assert.ok(result.success, `Expected valid, got: ${result.error?.message}`);
  });

  it("accepts null for optional sections", () => {
    const minimal = {
      ...VALID_OUTPUT,
      official_statements: null,
      unclear_points: null,
      information_to_verify: null,
    };
    const result = geminiNormalizedArticleSchema.safeParse(minimal);
    assert.ok(result.success);
  });

  it("rejects missing title", () => {
    const { title: _, ...noTitle } = VALID_OUTPUT;
    const result = geminiNormalizedArticleSchema.safeParse(noTitle);
    assert.ok(!result.success);
  });

  it("rejects empty executive_summary", () => {
    const result = geminiNormalizedArticleSchema.safeParse({
      ...VALID_OUTPUT,
      executive_summary: "",
    });
    assert.ok(!result.success);
  });

  it("rejects confidence > 1", () => {
    const result = geminiNormalizedArticleSchema.safeParse({
      ...VALID_OUTPUT,
      confidence: 1.5,
    });
    assert.ok(!result.success);
  });

  it("rejects confidence < 0", () => {
    const result = geminiNormalizedArticleSchema.safeParse({
      ...VALID_OUTPUT,
      confidence: -0.1,
    });
    assert.ok(!result.success);
  });
});

// ── 3. Grounding validation ─────────────────────────────────────────────────

describe("validateNormalizationGrounding", () => {
  it("passes for well-grounded output", () => {
    const result = validateNormalizationGrounding(VALID_OUTPUT, SAMPLE_INPUT.body);
    assert.ok(result.passed, `Expected pass, got issues: ${result.issues.join(", ")}`);
  });

  it("fails when confidence is below 0.7", () => {
    const lowConf = { ...VALID_OUTPUT, confidence: 0.5 };
    const result = validateNormalizationGrounding(lowConf, SAMPLE_INPUT.body);
    assert.ok(!result.passed);
    assert.ok(result.issues.some((i) => i.includes("Low confidence")));
  });

  it("fails when title is empty", () => {
    const noTitle = { ...VALID_OUTPUT, title: "" };
    const result = validateNormalizationGrounding(noTitle, SAMPLE_INPUT.body);
    assert.ok(!result.passed);
    assert.ok(result.issues.some((i) => i.includes("Empty title")));
  });

  it("flags ungrounded numbers", () => {
    const fabricated = {
      ...VALID_OUTPUT,
      confirmed_facts: "Un total de 99999 écoles et 88888 étudiants seront concernés.",
    };
    const result = validateNormalizationGrounding(fabricated, SAMPLE_INPUT.body);
    assert.ok(result.issues.some((i) => i.includes("numbers not grounded")));
  });

  it("flags fabricated quotes", () => {
    const fabricated = {
      ...VALID_OUTPUT,
      official_statements:
        '« Cette phrase totalement inventée ne vient pas du texte source original du tout »',
    };
    const result = validateNormalizationGrounding(fabricated, SAMPLE_INPUT.body);
    assert.ok(result.issues.some((i) => i.includes("quoted passage")));
  });

  it("passes when optional sections are null", () => {
    const minimal = {
      ...VALID_OUTPUT,
      official_statements: null,
      unclear_points: null,
      information_to_verify: null,
    };
    const result = validateNormalizationGrounding(minimal, SAMPLE_INPUT.body);
    assert.ok(result.passed);
  });
});

// ── 4. Markdown formatter ───────────────────────────────────────────────────

describe("formatNormalizedArticle", () => {
  it("produces markdown with correct heading structure (no emojis)", () => {
    const md = formatNormalizedArticle(VALID_OUTPUT);
    assert.ok(md.includes("## Faits confirmés"));
    assert.ok(md.includes("## Déclarations officielles"));
    assert.ok(md.includes("## Points non clarifiés"));
    assert.ok(md.includes("## Pourquoi c'est important"));
    assert.ok(md.includes("## Source"));
  });

  it("does not include title or summary in body markdown", () => {
    const md = formatNormalizedArticle(VALID_OUTPUT);
    // Title is rendered by the page <h1>, not in body
    assert.ok(!md.startsWith("# "));
    // Executive summary is rendered separately, not in body
    assert.ok(!md.includes("Résumé exécutif"));
  });

  it("contains no emoji characters in headings", () => {
    const md = formatNormalizedArticle(VALID_OUTPUT);
    const headings = md.split("\n").filter((l) => l.startsWith("## "));
    for (const h of headings) {
      assert.ok(!/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(h), `Emoji found in heading: ${h}`);
    }
  });

  it("omits Déclarations officielles when null", () => {
    const noStatements = { ...VALID_OUTPUT, official_statements: null };
    const md = formatNormalizedArticle(noStatements);
    assert.ok(!md.includes("Déclarations officielles"));
  });

  it("omits Points non clarifiés when null", () => {
    const noPending = { ...VALID_OUTPUT, unclear_points: null };
    const md = formatNormalizedArticle(noPending);
    assert.ok(!md.includes("Points non clarifiés"));
  });

  it("omits Informations à vérifier when null", () => {
    const noVerify = { ...VALID_OUTPUT, information_to_verify: null };
    const md = formatNormalizedArticle(noVerify);
    assert.ok(!md.includes("Informations à vérifier"));
  });

  it("includes Informations à vérifier when present", () => {
    const md = formatNormalizedArticle(VALID_OUTPUT);
    assert.ok(md.includes("## Informations à vérifier"));
    assert.ok(md.includes("Nombre d'élèves bénéficiaires"));
  });

  it("contains the source citation", () => {
    const md = formatNormalizedArticle(VALID_OUTPUT);
    assert.ok(md.includes("Le Nouvelliste — https://lenouvelliste.com/article/123456"));
  });
});
