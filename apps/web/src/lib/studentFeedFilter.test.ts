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

  it("allows generic neutral news without blocklist words", () => {
    expect(
      isAllowedInStudentFeed({
        title: "L'économie haïtienne en croissance ce trimestre",
        summary: "Les experts notent une tendance positive.",
        category: "news",
      }),
    ).toBe(true);
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
});
