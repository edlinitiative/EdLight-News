import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyItem,
  isStockMarketFalsePositive,
  lacksScholarshipEvidence,
} from "./classify.js";

describe("classifyItem - bourses disambiguation regression suite", () => {
  // ── Stock-market false positives (commit 527317c) ────────────────────
  it("does NOT tag a Wall Street / NYSE story as a scholarship", () => {
    const result = classifyItem(
      "La Bourse de New York chute après l'annonce des tarifs douaniers de Trump",
      "Wall Street recule fortement après l'annonce de nouveaux tarifs. Le Dow Jones perd 2%.",
      "Les indices boursiers américains ont enregistré leur pire séance depuis des mois. Les investisseurs craignent une escalade commerciale.",
    );
    assert.equal(result.isOpportunity, false, "stock market story must not be opportunity");
  });

  it("flags stock-market vocabulary via isStockMarketFalsePositive", () => {
    assert.equal(
      isStockMarketFalsePositive("Wall Street en baisse, le Dow Jones perd 1.5%"),
      true,
    );
    assert.equal(
      isStockMarketFalsePositive("Cotation de l'action en hausse à la bourse de Paris"),
      true,
    );
  });

  // ── Weak-signal false positives (commit 976017d) ─────────────────────
  // These mirror real items from production where BOURSES_WB matched via
  // "financement" / "grant" / "prise en charge" in non-academic contexts,
  // and "candidat" / "deadline" alone were too weak to confirm scholarship.
  it("does NOT tag UN succession news (matched via 'grant') as a scholarship", () => {
    const result = classifyItem(
      "ONU : quatre candidats en lice pour succéder à Antonio Guterres",
      "Le grant de mandat onusien arrive à terme. Quatre candidats en lice. Date limite de dépôt vendredi.",
      "Le processus de sélection démarre la semaine prochaine au Conseil de Sécurité.",
    );
    assert.equal(
      result.isOpportunity,
      false,
      "diplomatic succession news must not be tagged as bourses",
    );
  });

  it("does NOT tag military recruitment (matched via 'financement') as a scholarship", () => {
    const result = classifyItem(
      "Renforcement institutionnel : 339 nouveaux soldats intègrent les FAd'H",
      "Le financement de la nouvelle promotion militaire est assuré. Appel à candidatures clos.",
      "Cette promotion fait suite à un appel lancé l'année dernière par le ministère de la Défense.",
    );
    assert.equal(
      result.isOpportunity,
      false,
      "military recruitment must not be tagged as bourses",
    );
  });

  it("flags articles with no strict scholarship keyword via lacksScholarshipEvidence", () => {
    // Has weak signals (candidat, deadline) but no bours/scholarship/fellowship/tuition keyword.
    assert.equal(
      lacksScholarshipEvidence(
        "Quatre candidats en lice. Date limite de dépôt vendredi prochain.",
      ),
      true,
    );
  });

  // ── True positives must still pass ────────────────────────────────────
  it("DOES tag a real Fulbright scholarship as bourses", () => {
    const result = classifyItem(
      "Bourse Fulbright 2025 : appel à candidatures pour les étudiants haïtiens",
      "Le programme Fulbright ouvre ses candidatures pour des bourses d'études aux États-Unis. Date limite : 30 mars.",
      "La bourse couvre les frais de scolarité, le voyage et une allocation mensuelle. Les candidats doivent détenir une licence.",
    );
    assert.equal(result.isOpportunity, true);
    assert.equal(result.category, "bourses");
  });

  it("DOES tag a Campus France scholarship as bourses", () => {
    const result = classifyItem(
      "Campus France lance un nouveau programme de bourses d'études",
      "Une bourse pour étudier en France couvrant les frais de scolarité et l'hébergement.",
      "Les étudiants en master peuvent postuler. La bourse Eiffel finance jusqu'à 24 mois de formation.",
    );
    assert.equal(result.isOpportunity, true);
    assert.equal(result.category, "bourses");
  });

  it("does NOT confuse 'remise de bourses' style genuine scholarship news", () => {
    // Genuine scholarship ceremony — has both stock-market-free vocabulary
    // AND a strict scholarship keyword ("bours"), so it should pass.
    const result = classifyItem(
      "Cérémonie de remise des bourses d'études aux lauréats 2024",
      "Le ministère a remis des bourses universitaires à 50 étudiants méritants pour leur fellowship à l'étranger.",
      "Ces bourses d'études couvrent une année académique complète, incluant les frais de scolarité.",
    );
    assert.equal(result.isOpportunity, true);
    assert.equal(result.category, "bourses");
  });
});
