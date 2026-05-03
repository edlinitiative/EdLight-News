/**
 * Tests for opportunityScoring.ts — production cases from /opportunites
 * misclassifications.
 *
 * Run with: pnpm --filter @edlight-news/generator test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  scoreOpportunity,
  passesOpportunityGate,
  matchSubcategory,
  normalizeForOpportunity,
  OPPORTUNITY_SCORE_THRESHOLD,
} from "./opportunityScoring.js";

describe("scoreOpportunity — real opportunities (should pass)", () => {
  it("Fulbright scholarship with deadline scores high", () => {
    const r = scoreOpportunity({
      title: "Bourse Fulbright 2026 pour étudiants haïtiens",
      summary:
        "L'ambassade des États-Unis lance l'appel à candidatures pour la bourse Fulbright. Date limite : 15 mars 2026.",
      body: "Pour postuler, soumettre votre candidature en ligne. Eligibilité : étudiants haïtiens en master ou doctorat.",
      deadline: "2026-03-15",
      publisherName: "Campus France",
    });
    assert.ok(r.score >= 80, `expected ≥80, got ${r.score} — reasons: ${r.reasons.join(", ")}`);
    assert.equal(r.subcategory, "bourses");
  });

  it("Internship offer with apply verb passes", () => {
    const r = scoreOpportunity({
      title: "Offre de stage en marketing chez UNESCO Haïti",
      summary:
        "L'UNESCO recrute un stagiaire pour un stage de 6 mois à Port-au-Prince. Postuler avant le 30 mai.",
      deadline: "2026-05-30",
    });
    assert.ok(r.score >= OPPORTUNITY_SCORE_THRESHOLD, `expected ≥50, got ${r.score}`);
    assert.equal(r.subcategory, "stages");
  });

  it("Hackathon competition passes", () => {
    const r = scoreOpportunity({
      title: "Hackathon Caraïbes 2026 — inscriptions ouvertes",
      summary:
        "Étudiants universitaires : participez au hackathon régional. Apply for the challenge before June 1st.",
      deadline: "2026-06-01",
    });
    assert.ok(r.score >= OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
    assert.equal(r.subcategory, "concours");
  });

  it("Erasmus programme with named brand passes", () => {
    const r = scoreOpportunity({
      title: "Programme Erasmus+ : candidatures ouvertes pour 2026",
      summary:
        "Erasmus annonce l'ouverture des inscriptions pour le programme d'échange. Étudiants admis dans une université partenaire peuvent postuler.",
    });
    assert.ok(r.score >= OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
    assert.equal(r.subcategory, "programmes");
  });
});

describe("scoreOpportunity — false positives (should fail gate)", () => {
  it("'À ce stage du processus politique' is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "À ce stage du processus, le CPT doit décider",
      summary:
        "Le Conseil présidentiel de transition est arrivé à un stage critique. Les députés débattent du mandat.",
    });
    assert.ok(
      r.score < OPPORTUNITY_SCORE_THRESHOLD,
      `expected <${OPPORTUNITY_SCORE_THRESHOLD}, got ${r.score} — reasons: ${r.reasons.join(", ")}`,
    );
  });

  it("'Programme du gouvernement' is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "Le programme du nouveau gouvernement de transition",
      summary:
        "Le Premier ministre présente le programme du gouvernement devant le Parlement. Les sénateurs réagissent.",
    });
    assert.ok(r.score < OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
  });

  it("'Formation du conseil présidentiel' is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "Formation du conseil présidentiel : les noms sont connus",
      summary:
        "La formation du nouveau conseil présidentiel a été annoncée. Le scrutin reste à organiser.",
    });
    assert.ok(r.score < OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
  });

  it("'Concours général de la fonction publique' is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "Le concours de recrutement de la fonction publique annulé",
      summary:
        "Le gouvernement a suspendu le concours de recrutement pour la fonction publique en raison de la crise.",
    });
    assert.ok(r.score < OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
  });

  it("'Date limite d'inscription électorale' is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "Date limite d'inscription des électeurs reportée",
      summary:
        "Le CEP annonce le report de la date limite pour l'inscription des électeurs sur les listes du scrutin.",
      deadline: "2026-04-30",
    });
    assert.ok(r.score < OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
  });

  it("'Appel à candidature pour Premier ministre' is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "Appel à candidature pour le poste de Premier ministre",
      summary:
        "Le Conseil présidentiel lance un appel à candidatures pour le poste de Premier ministre. Les députés évalueront les dossiers.",
    });
    assert.ok(r.score < OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
  });

  it("'Master plan présidentiel' is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "Le master plan du Premier ministre pour la sécurité",
      summary:
        "Le gouvernement dévoile son master plan pour lutter contre les gangs. La PNH sera renforcée.",
    });
    assert.ok(r.score < OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
  });

  it("'BRH augmente le taux directeur' (finance news) is NOT an opportunity", () => {
    const r = scoreOpportunity({
      title: "La BRH augmente le taux directeur — la bourse réagit",
      summary:
        "La Banque centrale a relevé son taux directeur. Wall Street et la bourse de Paris suivent. L'inflation reste élevée.",
    });
    assert.ok(r.score < OPPORTUNITY_SCORE_THRESHOLD, `got ${r.score}`);
  });
});

describe("matchSubcategory", () => {
  it("returns strict for 'offre de stage'", () => {
    const m = matchSubcategory(normalizeForOpportunity("Offre de stage chez UNDP"));
    assert.equal(m.subcategory, "stages");
    assert.equal(m.strength, "strict");
  });

  it("returns weak for 'stage' + 'postuler'", () => {
    const m = matchSubcategory(normalizeForOpportunity("Stage à Port-au-Prince — postuler ici"));
    assert.equal(m.subcategory, "stages");
    assert.equal(m.strength, "weak");
  });

  it("returns none for 'stage' alone in political context", () => {
    const m = matchSubcategory(
      normalizeForOpportunity("À ce stage du processus politique"),
    );
    assert.equal(m.subcategory, null);
  });

  it("returns strict for 'hackathon'", () => {
    const m = matchSubcategory(normalizeForOpportunity("Hackathon Haïti 2026"));
    assert.equal(m.subcategory, "concours");
    assert.equal(m.strength, "strict");
  });
});

describe("passesOpportunityGate", () => {
  it("real Fulbright passes", () => {
    assert.equal(
      passesOpportunityGate({
        title: "Bourse Fulbright 2026",
        summary: "Appel à candidatures, date limite 15 mars",
        deadline: "2026-03-15",
      }),
      true,
    );
  });

  it("political stage news fails", () => {
    assert.equal(
      passesOpportunityGate({
        title: "À ce stage du processus politique haïtien",
        summary: "Le Premier ministre déclare…",
      }),
      false,
    );
  });
});
