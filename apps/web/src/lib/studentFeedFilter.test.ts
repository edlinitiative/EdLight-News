/**
 * Tests for the student feed filter.
 *
 * Run with: npx vitest run src/lib/studentFeedFilter.test.ts
 */

import { describe, it, expect } from "vitest";
import { isAllowedInStudentFeed } from "./studentFeedFilter";

describe("isAllowedInStudentFeed", () => {
  // ── Blocked cases ───────────────────────────────────────────────────────

  it("blocks a crime headline", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Fusillade dans le centre-ville : trois morts",
        summary: "Une attaque armée a fait trois victimes hier soir.",
        category: "local_news",
      }),
    ).toBe(false);
  });

  it("blocks a pure elections headline", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Élections présidentielles : le parti annonce sa coalition",
        summary: "Le président sortant prépare la coalition parlementaire.",
      }),
    ).toBe(false);
  });

  it("blocks kidnapping news", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Kidnapping en série : la police recherche les gangs responsables",
        category: "local_news",
      }),
    ).toBe(false);
  });

  it("blocks a generic université mention with crime keywords", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Explosion près de l'université : trois morts",
        summary: "La police enquête sur l'incendie.",
      }),
    ).toBe(false);
  });

  it("blocks kidnapping attempt with no education keyword", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Tentative d'enlèvement d'un commerçant à Port-au-Prince",
        summary: "La victime a été libérée après le paiement d'une rançon.",
        category: "local_news",
      }),
    ).toBe(false);
  });

  it("blocks elections headline with no education context", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Élections : la coalition au parlement s'effondre",
        summary: "Le président convoque une session extraordinaire.",
      }),
    ).toBe(false);
  });

  // ── Allowed cases ───────────────────────────────────────────────────────

  it("allows a scholarship deadline article", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Bourse Chevening : deadline le 15 mars",
        summary: "Les candidatures pour la bourse Chevening sont ouvertes.",
        category: "scholarship",
      }),
    ).toBe(true);
  });

  it("allows an education policy article mentioning elections", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Après les élections, le MENFP annonce de nouvelles formations",
        summary: "Le programme de formation des enseignants est lancé.",
      }),
    ).toBe(true);
  });

  it("allows a disaster article with student guidance (examen)", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Cyclone : les examens du bac reportés",
        summary: "Le MENFP confirme le report des examens officiels.",
      }),
    ).toBe(true);
  });

  it("allows an article in a hard-allow category", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Conférence sur le leadership en Haïti",
        category: "Bourses",
      }),
    ).toBe(true);
  });

  it("allows an article in the Opportunités category", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Programme de stages dans la finance",
        category: "opportunités",
      }),
    ).toBe(true);
  });

  it("blocks generic neutral news without student-relevance signal", () => {
    expect(
      isAllowedInStudentFeed({
        title: "L'économie haïtienne en croissance ce trimestre",
        summary: "Les experts notent une tendance positive.",
        category: "news",
      }),
    ).toBe(false);
  });

  it("allows an article with multiple allowlist hits even with a politics keyword", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Le président visite l'université et annonce des bourses",
        summary: "Inscription ouverte pour les formations de l'UEH.",
      }),
    ).toBe(true);
  });

  it("allows Haïti category education news", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Campus France Haïti : nouvelles sessions d'orientation",
        summary: "Les étudiants peuvent s'inscrire dès maintenant.",
        category: "local_news",
        geoLabel: "HT",
      }),
    ).toBe(true);
  });

  it("allows MENFP education-impact notice despite insecurity context", () => {
    expect(
      isAllowedInStudentFeed({
        title: "MENFP annonce report des examens suite à insécurité",
        summary: "Les examens officiels sont reportés jusqu'à nouvel ordre.",
      }),
    ).toBe(true);
  });

  it("allows crime-context article when university closure is explicit", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Gang : l'université fermée jusqu'à nouvel ordre",
        summary: "Les cours sont suspendus à cause de l'insécurité.",
      }),
    ).toBe(true);
  });

  it("allows a simple bourse article", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Bourse d'études en France pour étudiants haïtiens",
        summary: "Les candidatures sont ouvertes pour la rentrée 2026.",
      }),
    ).toBe(true);
  });

  // ── v3: French suffix matching ──────────────────────────────────────

  it("blocks crime with French feminine form (tuée)", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Une marchande tuée par un câble à haute tension",
        summary: "Un drame à Pétion-Ville.",
        category: "local_news",
      }),
    ).toBe(false);
  });

  it("blocks crime with French plural (gangs)", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Recrutement d'enfants par les gangs en Haïti",
        category: "news",
      }),
    ).toBe(false);
  });

  it("blocks violence keyword", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Violences redoublées dans les camps de déplacés",
        category: "news",
      }),
    ).toBe(false);
  });

  // ── v3: General news requires positive student signal ───────────────

  it("blocks general news with no student-relevance signal", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Taux de référence BRH du 22 février : 130 gourdes pour 1 USD",
        summary: "Le taux sert de référence pour les transactions.",
        category: "news",
      }),
    ).toBe(false);
  });

  it("blocks political news (corruption)", () => {
    expect(
      isAllowedInStudentFeed({
        title: "AyiboPost révèle la corruption dans l'administration",
        summary: "Des transactions en espèces contournent les contrôles.",
        category: "news",
      }),
    ).toBe(false);
  });

  it("allows general news with education keyword", () => {
    expect(
      isAllowedInStudentFeed({
        title: "L'UEH et Elms College s'associent pour la formation des enseignants",
        summary: "Un partenariat pour améliorer l'éducation en Haïti.",
        category: "news",
      }),
    ).toBe(true);
  });

  // ── v3: Vertical / itemType auto-allow ──────────────────────────────

  it("allows article with opportunites vertical", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Conférence sur le leadership",
        category: "news",
        vertical: "opportunites",
      }),
    ).toBe(true);
  });

  it("allows utility item regardless of content", () => {
    expect(
      isAllowedInStudentFeed({
        title: "Dates limites des concours cette semaine",
        category: "news",
        itemType: "utility",
      }),
    ).toBe(true);
  });
});
