#!/usr/bin/env tsx
/**
 * IG Formatter Audit Script
 *
 * Exercises every formatter with realistic mock data and checks for:
 *  1. Duplicate slides (Jaccard word-overlap > 0.40)
 *  2. Text overflow (heading/bullet exceeding renderer constraints)
 *  3. Empty slides (no heading and no bullets)
 *  4. Missing source attribution on last slide
 *  5. Caption too long (>2200) or suspiciously short (<100)
 *  6. Cover slide issues (clipping risk: long headline + body)
 *  7. Bullet count overflow (>8 on explanation, >6 on headline)
 *  8. English leaking into French slides
 *  9. Junk/scraping artifacts in output
 * 10. Slide count out of range (too few or too many)
 *
 * Usage: npx tsx packages/generator/src/ig/audit-formatters.ts
 */

import type { Item, IGFormattedPayload, IGSlide } from "@edlight-news/types";
import type { BilingualText } from "./formatters/helpers.js";
import { buildNewsCarousel } from "./formatters/news.js";
import { buildHistoireCarousel } from "./formatters/histoire.js";
import { buildScholarshipCarousel } from "./formatters/scholarship.js";
import { buildOpportunityCarousel } from "./formatters/opportunity.js";
import { buildUtilityCarousel } from "./formatters/utility.js";

// Minimal Timestamp mock for test items
const Timestamp = {
  now: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0, toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => true, valueOf: () => "" }),
};

// ── Renderer constraints (from design-tokens + ig-carousel CSS) ────────────
const CANVAS = { width: 1080, height: 1350 };
const MAX_CAPTION = 2200;
const HEADLINE_HERO_FONT = 88;  // first slide
const HEADLINE_INNER_FONT = 64; // inner slides
const BODY_FONT = 34;
const LINE_HEIGHT_H = 1.05;
const LINE_HEIGHT_BODY = 1.50;

// Approximate max chars per line at given font size (1080px - 2*90px margins = 900px usable)
const USABLE_WIDTH = 900;
const CHARS_PER_LINE_HERO = Math.floor(USABLE_WIDTH / (HEADLINE_HERO_FONT * 0.55));  // ~18
const CHARS_PER_LINE_INNER = Math.floor(USABLE_WIDTH / (HEADLINE_INNER_FONT * 0.50)); // ~28
const CHARS_PER_LINE_BODY = Math.floor(USABLE_WIDTH / (BODY_FONT * 0.48));            // ~55

// Max visible lines per CSS clamp
const HEADLINE_CLAMP_FIRST = 5;
const HEADLINE_CLAMP_INNER = 4;
const BODY_CLAMP_FIRST = 3;
const BODY_CLAMP_EXPLANATION = 8;

// ── Similarity check ───────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "en",
  "est", "sont", "dans", "pour", "par", "avec", "sur", "qui", "que",
  "ce", "cette", "au", "aux", "se", "ne", "pas", "a", "à", "été",
  "il", "elle", "ils", "ont", "son", "sa", "ses", "leurs", "leur",
  "mais", "ou", "où", "aussi", "plus", "très", "tout", "tous",
  "the", "of", "and", "to", "in", "is", "for", "that", "on", "was",
]);

function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/);
  return new Set(words.filter((w) => w.length > 2 && !STOP_WORDS.has(w)));
}

function jaccard(a: string, b: string): number {
  const setA = contentWords(a);
  const setB = contentWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) { if (setB.has(w)) inter++; }
  return inter / (setA.size + setB.size - inter);
}

// ── English detection ──────────────────────────────────────────────────────
const EN_MARKERS = [
  /\bmust be\b/i, /\bshould be\b/i, /\bapplicants?\b/i,
  /\brequired\b/i, /\bsubmit\b/i, /\byou must\b/i,
  /\beligible\b/i, /\bcitizens? of\b/i, /\bopen to\b/i,
  /\bapplication form\b/i, /\bscholarship\b/i,
];

function looksEnglish(text: string): boolean {
  if (!text || text.length < 15) return false;
  let hits = 0;
  for (const re of EN_MARKERS) { if (re.test(text)) hits++; if (hits >= 2) return true; }
  return false;
}

// ── Junk detection ─────────────────────────────────────────────────────────
const JUNK_PATTERNS = [
  /cookie/i, /prévenez-moi/i, /enregistrer mon nom/i,
  /laisser un commentaire/i, /insert_random/i, /zoneid=/i,
  /<img\s/i, /<a\s/i, /\.php/i, /\.aspx/i,
];

function hasJunk(text: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(text));
}

// ── Issue tracking ─────────────────────────────────────────────────────────
type Severity = "🔴 CRITICAL" | "🟠 WARNING" | "🟡 INFO";
interface Issue {
  severity: Severity;
  formatter: string;
  scenario: string;
  message: string;
}

const issues: Issue[] = [];
let totalTests = 0;
let passedTests = 0;

function report(severity: Severity, formatter: string, scenario: string, message: string) {
  issues.push({ severity, formatter, scenario, message });
}

// ── Audit checks for a single formatter output ────────────────────────────
function auditPayload(
  result: IGFormattedPayload,
  formatter: string,
  scenario: string,
) {
  totalTests++;
  const { slides, caption } = result;
  let hasIssue = false;

  // 1. Slide count
  if (slides.length === 0) {
    report("🔴 CRITICAL", formatter, scenario, "Zero slides produced");
    hasIssue = true;
  }
  if (slides.length === 1) {
    report("🟠 WARNING", formatter, scenario, "Only 1 slide (just cover, no content)");
    hasIssue = true;
  }
  if (slides.length > 10) {
    report("🟠 WARNING", formatter, scenario, `Too many slides: ${slides.length} (IG max is 10)`);
    hasIssue = true;
  }

  // 2. Duplicate slides (Jaccard similarity)
  for (let i = 0; i < slides.length; i++) {
    for (let j = i + 1; j < slides.length; j++) {
      const textA = slideText(slides[i]!);
      const textB = slideText(slides[j]!);
      const sim = jaccard(textA, textB);
      if (sim > 0.55) {
        report("🔴 CRITICAL", formatter, scenario,
          `Slides ${i + 1} & ${j + 1} are near-duplicates (Jaccard=${sim.toFixed(2)})\n` +
          `  Slide ${i + 1}: "${textA.slice(0, 80)}…"\n` +
          `  Slide ${j + 1}: "${textB.slice(0, 80)}…"`);
        hasIssue = true;
      } else if (sim > 0.40) {
        report("🟠 WARNING", formatter, scenario,
          `Slides ${i + 1} & ${j + 1} have high overlap (Jaccard=${sim.toFixed(2)})\n` +
          `  Slide ${i + 1}: "${textA.slice(0, 80)}…"\n` +
          `  Slide ${j + 1}: "${textB.slice(0, 80)}…"`);
        hasIssue = true;
      }
    }
  }

  // 3. Empty slides
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]!;
    if (!s.heading && (!s.bullets || s.bullets.length === 0) && !s.statValue) {
      report("🔴 CRITICAL", formatter, scenario, `Slide ${i + 1} is completely empty`);
      hasIssue = true;
    }
  }

  // 4. Text overflow checks
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]!;
    const isFirst = i === 0;

    // Heading overflow
    if (s.heading) {
      const charsPerLine = isFirst ? CHARS_PER_LINE_HERO : CHARS_PER_LINE_INNER;
      const maxClamp = isFirst ? HEADLINE_CLAMP_FIRST : HEADLINE_CLAMP_INNER;
      const estLines = Math.ceil(s.heading.length / charsPerLine);
      if (estLines > maxClamp) {
        report("🟠 WARNING", formatter, scenario,
          `Slide ${i + 1} heading will clip (~${estLines} lines, clamp=${maxClamp}): "${s.heading.slice(0, 60)}…"`);
        hasIssue = true;
      }
    }

    // Body/bullet overflow
    if (s.bullets && s.layout === "explanation") {
      const totalBulletText = s.bullets.join(" ");
      const estLines = Math.ceil(totalBulletText.length / CHARS_PER_LINE_BODY);
      if (estLines > BODY_CLAMP_EXPLANATION) {
        report("🟠 WARNING", formatter, scenario,
          `Slide ${i + 1} bullets may clip (~${estLines} lines, clamp=${BODY_CLAMP_EXPLANATION})`);
        hasIssue = true;
      }
      if (s.bullets.length > 6) {
        report("🟠 WARNING", formatter, scenario,
          `Slide ${i + 1} has ${s.bullets.length} bullets (likely overflow)`);
        hasIssue = true;
      }
    }

    // Cover slide: heading + body combined overflow
    if (isFirst && s.bullets && s.bullets.length > 0) {
      const headingLines = Math.ceil((s.heading?.length ?? 0) / CHARS_PER_LINE_HERO);
      const bodyLines = Math.ceil(s.bullets.join(" ").length / CHARS_PER_LINE_BODY);
      const headingPx = headingLines * HEADLINE_HERO_FONT * LINE_HEIGHT_H;
      const bodyPx = bodyLines * BODY_FONT * LINE_HEIGHT_BODY;
      const totalPx = headingPx + bodyPx + 120 + 100 + 80; // margins + pill + padding
      if (totalPx > CANVAS.height) {
        report("🔴 CRITICAL", formatter, scenario,
          `Cover slide may clip: ~${Math.round(totalPx)}px content vs ${CANVAS.height}px canvas`);
        hasIssue = true;
      }
    }
  }

  // 5. Source attribution
  const lastSlide = slides[slides.length - 1];
  if (lastSlide && !lastSlide.footer) {
    report("🟠 WARNING", formatter, scenario, "Last slide missing source footer");
    hasIssue = true;
  }
  if (lastSlide?.footer && !lastSlide.footer.toLowerCase().includes("source")) {
    report("🟡 INFO", formatter, scenario, `Last slide footer doesn't mention 'source': "${lastSlide.footer}"`);
  }

  // 6. Caption checks
  if (caption.length > MAX_CAPTION) {
    report("🔴 CRITICAL", formatter, scenario, `Caption too long: ${caption.length} chars (max ${MAX_CAPTION})`);
    hasIssue = true;
  }
  if (caption.length < 80) {
    report("🟠 WARNING", formatter, scenario, `Caption suspiciously short: ${caption.length} chars`);
    hasIssue = true;
  }

  // 7. English leak detection
  for (let i = 0; i < slides.length; i++) {
    const text = slideText(slides[i]!);
    if (looksEnglish(text)) {
      report("🟠 WARNING", formatter, scenario,
        `Slide ${i + 1} appears to contain English: "${text.slice(0, 80)}…"`);
      hasIssue = true;
    }
  }

  // 8. Junk/scraping artifacts
  for (let i = 0; i < slides.length; i++) {
    const text = slideText(slides[i]!);
    if (hasJunk(text)) {
      report("🔴 CRITICAL", formatter, scenario,
        `Slide ${i + 1} contains scraping junk: "${text.slice(0, 80)}…"`);
      hasIssue = true;
    }
  }
  if (hasJunk(caption)) {
    report("🟠 WARNING", formatter, scenario, "Caption contains scraping junk");
    hasIssue = true;
  }

  if (!hasIssue) passedTests++;
}

function slideText(s: IGSlide): string {
  return [s.heading ?? "", ...(s.bullets ?? [])].join(" ").trim();
}

// ── Mock data factory ──────────────────────────────────────────────────────
const NOW = Timestamp.now();

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: "test-item-1",
    rawItemId: "raw-1",
    sourceId: "src-1",
    title: "Titre par défaut de l'article de test",
    summary: "Résumé par défaut de l'article.",
    canonicalUrl: "https://example.com/article",
    category: "news",
    deadline: null,
    evergreen: false,
    confidence: 0.85,
    qualityFlags: { hasSourceUrl: true, needsReview: false, lowConfidence: false, reasons: [] },
    citations: [{ sourceName: "Le Nouvelliste", sourceUrl: "https://lenouvelliste.com/test" }],
    source: { name: "Le Nouvelliste", originalUrl: "https://lenouvelliste.com/test" },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Item;
}

// ── Test scenarios ─────────────────────────────────────────────────────────

function runAll() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  IG FORMATTER AUDIT — Expected vs Likely Output");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ════════════════════════════════════════════════════════════════════════
  // NEWS FORMATTER
  // ════════════════════════════════════════════════════════════════════════

  // Scenario 1: News with Gemini sections (rich path)
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "L'OEA envoie une mission d'évaluation en Haïti pour la crise sécuritaire",
        summary: "L'Organisation des États Américains a décidé d'envoyer une mission d'évaluation en Haïti pour évaluer la situation sécuritaire et les conditions humanitaires dans le pays.",
        geoTag: "HT",
        imageUrl: "https://example.com/img.jpg",
        extractedText: "L'OEA a décidé d'envoyer une mission en Haïti. La décision a été prise lors de la session extraordinaire du conseil permanent. L'organisation veut évaluer la situation sécuritaire. Les membres ont voté à l'unanimité. La mission sera composée de diplomates. Elle devrait durer deux semaines. Le gouvernement haïtien a salué cette décision. Les autorités locales attendent la mission. La communauté internationale suit de près les développements.",
      }),
      {
        frTitle: "L'OEA envoie une mission d'évaluation en Haïti pour la crise sécuritaire",
        frSummary: "L'Organisation des États Américains a décidé d'envoyer une mission d'évaluation en Haïti.",
        htSummary: "OEA deside voye yon misyon evalyasyon ann Ayiti pou kriz sekiritè a.",
        frSections: [
          { heading: "Ce qui s'est passé", content: "L'Organisation des États Américains a voté à l'unanimité l'envoi d'une mission d'évaluation en Haïti lors d'une session extraordinaire de son conseil permanent. Cette décision intervient après des semaines de détérioration de la situation sécuritaire dans le pays." },
          { heading: "Contexte", content: "Haïti fait face à une crise sécuritaire sans précédent, avec des gangs armés contrôlant une partie significative de Port-au-Prince. L'insécurité a provoqué le déplacement de centaines de milliers de personnes." },
          { heading: "Pourquoi c'est important", content: "Cette mission pourrait ouvrir la voie à une intervention internationale plus structurée. Les recommandations de la mission influenceront les décisions du Conseil de Sécurité des Nations Unies concernant Haïti." },
        ],
      },
    ),
    "news", "Rich sections (OEA/Haiti)",
  );

  // Scenario 2: News with NO sections, short repetitive article
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "Le Premier Ministre rencontre le Secrétaire Général de l'ONU",
        summary: "Le Premier Ministre haïtien a rencontré le Secrétaire Général de l'ONU pour discuter de la situation en Haïti et demander une aide internationale renforcée.",
        geoTag: "HT",
        extractedText: "Le Premier Ministre haïtien a rencontré le Secrétaire Général des Nations Unies à New York. Lors de cette rencontre, le Premier Ministre a discuté de la situation sécuritaire en Haïti. Le chef du gouvernement haïtien a demandé une aide internationale renforcée pour faire face à la crise. Le Secrétaire Général de l'ONU a exprimé sa préoccupation concernant la situation en Haïti. Il a promis de mobiliser la communauté internationale pour aider Haïti. Le Premier Ministre a également sollicité un soutien pour les élections à venir.",
      }),
    ),
    "news", "No sections, repetitive extractedText",
  );

  // Scenario 3: News with only summary (no extractedText, no sections)
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "Séisme de magnitude 4.2 ressenti dans le Nord d'Haïti",
        summary: "Un séisme de magnitude 4.2 a été ressenti dans le département du Nord d'Haïti ce matin. Aucune victime n'a été signalée pour le moment. Les autorités surveillent la situation.",
        geoTag: "HT",
      }),
    ),
    "news", "Summary-only (no extractedText)",
  );

  // Scenario 4: News with English extractedText (should fallback to French summary)
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "Les États-Unis annoncent un nouveau programme d'aide pour Haïti",
        summary: "Les États-Unis ont annoncé un nouveau programme d'aide humanitaire de 50 millions de dollars pour Haïti, visant à renforcer la sécurité alimentaire et les infrastructures de santé.",
        extractedText: "The United States announced a new humanitarian aid program for Haiti worth $50 million. The program aims to strengthen food security and health infrastructure. Secretary of State confirmed the commitment during a press conference. The funds will be distributed through international organizations.",
        geoTag: "HT",
      }),
    ),
    "news", "English extractedText (fallback to French)",
  );

  // Scenario 5: News with very long headline
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "Le Conseil de Sécurité des Nations Unies adopte une nouvelle résolution autorisant le déploiement d'une force multinationale de sécurité en Haïti pour lutter contre les gangs armés et rétablir l'ordre public",
        summary: "Le Conseil de Sécurité a voté à l'unanimité pour le déploiement.",
        geoTag: "HT",
      }),
    ),
    "news", "Very long headline (overflow risk)",
  );

  // Scenario 6: News with sections + long section content
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "Crise alimentaire : le PAM lance un appel d'urgence pour Haïti",
        summary: "Le Programme Alimentaire Mondial a lancé un appel d'urgence pour financer l'aide alimentaire en Haïti.",
        geoTag: "HT",
        imageUrl: "https://example.com/pam.jpg",
      }),
      {
        frTitle: "Crise alimentaire : le PAM lance un appel d'urgence pour Haïti",
        frSummary: "Le Programme Alimentaire Mondial a lancé un appel d'urgence.",
        frSections: [
          { heading: "L'appel d'urgence", content: "Le Programme Alimentaire Mondial des Nations Unies a lancé un appel d'urgence de 200 millions de dollars pour financer l'aide alimentaire en Haïti. Selon le directeur régional du PAM, plus de 4,7 millions de personnes font face à une insécurité alimentaire aiguë dans le pays, dont 1,6 million en situation d'urgence. L'organisation prévoit de fournir des rations alimentaires à 2 millions de personnes au cours des six prochains mois, en ciblant les zones les plus touchées par l'insécurité et les catastrophes naturelles." },
          { heading: "Contexte humanitaire", content: "La situation humanitaire en Haïti s'est considérablement dégradée au cours des derniers mois. Les gangs armés bloquent les axes routiers principaux, empêchant l'acheminement de l'aide humanitaire vers les populations les plus vulnérables. Les prix des denrées alimentaires de base ont augmenté de 40% en un an, rendant la nourriture inaccessible pour de nombreuses familles haïtiennes." },
          { heading: "Réponse internationale", content: "Plusieurs pays donateurs ont déjà promis des contributions. La France a annoncé 15 millions d'euros, le Canada 20 millions de dollars canadiens, et l'Union européenne 30 millions d'euros. Cependant, le PAM estime que ces engagements ne couvrent que 30% des besoins identifiés." },
          { heading: "Défis logistiques", content: "L'acheminement de l'aide reste le principal défi. Les routes principales reliant Port-au-Prince aux provinces sont régulièrement bloquées par des groupes armés. Le PAM travaille avec les forces de sécurité pour identifier des corridors humanitaires sûrs et explore l'utilisation de voies maritimes alternatives pour atteindre les zones les plus isolées." },
          { heading: "Perspectives", content: "Sans un financement adéquat et rapide, le PAM prévient que la situation pourrait devenir catastrophique d'ici la fin de l'année. L'organisation appelle la communauté internationale à agir de toute urgence pour éviter une famine à grande échelle en Haïti." },
        ],
      },
    ),
    "news", "5 long Gemini sections (max content test)",
  );

  // ════════════════════════════════════════════════════════════════════════
  // HISTOIRE FORMATTER
  // ════════════════════════════════════════════════════════════════════════

  // Scenario 7: Histoire with rich sections
  auditPayload(
    buildHistoireCarousel(
      makeItem({
        title: "Jean-Jacques Dessalines : le père fondateur d'Haïti",
        summary: "Jean-Jacques Dessalines est le héros de l'indépendance haïtienne, premier dirigeant du pays libre.",
        category: "news",
        imageUrl: "https://example.com/dessalines.jpg",
        utilityMeta: {
          series: "HaitiHistory",
          utilityType: "history",
          citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org/wiki/Dessalines" }],
        },
      }),
      {
        frTitle: "Jean-Jacques Dessalines : le père fondateur d'Haïti",
        frSummary: "Jean-Jacques Dessalines est le héros de l'indépendance haïtienne.",
        htSummary: "Jean-Jacques Dessalines se ewo endepandans ayisyen an.",
        frSections: [
          { heading: "L'histoire", content: "Né en esclavage vers 1758, Jean-Jacques Dessalines s'est élevé pour devenir le principal artisan de l'indépendance d'Haïti. Après avoir combattu aux côtés de Toussaint Louverture, il a pris la tête de la révolution haïtienne dans sa phase finale." },
          { heading: "Contexte historique", content: "La colonie française de Saint-Domingue était la plus riche des Caraïbes, fondée sur le système esclavagiste le plus brutal des Amériques. La Révolution française de 1789 a ouvert la voie aux revendications d'égalité et de liberté." },
          { heading: "L'indépendance", content: "Le 1er janvier 1804, Dessalines proclame l'indépendance d'Haïti à Gonaïves, faisant de ce pays la première république noire indépendante au monde et la deuxième nation indépendante des Amériques après les États-Unis." },
          { heading: "Pourquoi ça compte", content: "L'héritage de Dessalines transcende les frontières d'Haïti. Sa lutte contre l'esclavage a inspiré des mouvements de libération dans toute l'Amérique latine et a profondément ébranlé le système colonial européen." },
        ],
      },
    ),
    "histoire", "Rich sections (HaitiHistory)",
  );

  // Scenario 8: Histoire with NO sections (legacy fallback)
  auditPayload(
    buildHistoireCarousel(
      makeItem({
        title: "La citadelle Laferrière : un monument de la liberté",
        summary: "La citadelle Laferrière est la plus grande forteresse des Amériques, construite après l'indépendance d'Haïti pour protéger le pays contre une éventuelle invasion française.",
        extractedText: "La citadelle Laferrière, aussi connue sous le nom de Citadelle Henry, est une grande forteresse située sur le sommet de la montagne Bonnet à l'Évêque, dans le Nord d'Haïti. Construite entre 1805 et 1820 sur ordre du roi Henri Christophe, elle est la plus grande forteresse des Amériques. La citadelle a été classée patrimoine mondial de l'UNESCO en 1982. Elle pouvait abriter jusqu'à 5 000 soldats et contenir des provisions pour résister à un siège d'un an. Ses murs mesurent jusqu'à 4 mètres d'épaisseur. La forteresse n'a jamais été attaquée par les Français.",
        imageUrl: "https://example.com/citadelle.jpg",
        utilityMeta: {
          series: "HaitiFactOfTheDay",
          utilityType: "daily_fact",
          citations: [{ label: "UNESCO", url: "https://whc.unesco.org/citadelle" }],
        },
      }),
    ),
    "histoire", "No sections (legacy fallback)",
  );

  // Scenario 9: HaitianOfTheWeek with sections
  auditPayload(
    buildHistoireCarousel(
      makeItem({
        title: "Michaëlle Jean : de réfugiée haïtienne à Gouverneure générale du Canada",
        summary: "Michaëlle Jean est une journaliste et diplomate haïtiano-canadienne qui a marqué l'histoire.",
        imageUrl: "https://example.com/jean.jpg",
        utilityMeta: {
          series: "HaitianOfTheWeek",
          utilityType: "profile",
          citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org/wiki/Michaelle_Jean" }],
        },
      }),
      {
        frTitle: "Michaëlle Jean : de réfugiée haïtienne à Gouverneure générale du Canada",
        frSummary: "Michaëlle Jean est une journaliste et diplomate haïtiano-canadienne remarquable.",
        htSummary: "Michaëlle Jean se yon jounalis ak diplomat ayisyano-kanadyèn remakab.",
        frSections: [
          { heading: "Parcours", content: "Née à Port-au-Prince en 1957, Michaëlle Jean a fui la dictature des Duvalier avec sa famille à l'âge de 11 ans. Installée au Canada, elle a poursuivi des études en littérature comparée et en langues romanes à l'Université de Montréal." },
          { heading: "Carrière journalistique", content: "Elle a été journaliste et animatrice à Radio-Canada et CBC, couvrant des sujets de société et de droits humains pendant plus de 15 ans. Son travail journalistique a mis en lumière les réalités des communautés marginalisées." },
          { heading: "Gouverneure générale", content: "En 2005, elle est devenue la 27e Gouverneure générale du Canada, la première personne noire et la première personne d'origine haïtienne à occuper ce poste. Son mandat a duré jusqu'en 2010." },
          { heading: "Héritage", content: "Après son mandat, elle a été nommée Secrétaire générale de l'Organisation internationale de la Francophonie de 2015 à 2019. Elle reste un symbole de résilience et de réussite pour la diaspora haïtienne." },
        ],
      },
    ),
    "histoire", "HaitianOfTheWeek with sections",
  );

  // ════════════════════════════════════════════════════════════════════════
  // SCHOLARSHIP FORMATTER
  // ════════════════════════════════════════════════════════════════════════

  // Scenario 10: Full scholarship with all fields
  auditPayload(
    buildScholarshipCarousel(
      makeItem({
        title: "Bourse Chevening du gouvernement britannique pour les étudiants haïtiens",
        summary: "La bourse Chevening offre un financement complet pour un master d'un an au Royaume-Uni, couvrant les frais de scolarité, le logement et les frais de voyage.",
        category: "scholarship",
        deadline: "2026-11-01",
        geoTag: "HT",
        imageUrl: "https://example.com/chevening.jpg",
        opportunity: {
          deadline: "2026-11-01",
          eligibility: [
            "Être citoyen d'un pays éligible (incluant Haïti)",
            "Avoir au moins 2 ans d'expérience professionnelle",
            "Avoir un diplôme de licence (baccalauréat + 4 ans)",
            "Maîtriser l'anglais (niveau IELTS 6.5 minimum)",
            "S'engager à retourner dans son pays après les études",
          ],
          coverage: "Frais de scolarité + logement + voyage + allocation mensuelle",
          howToApply: "Postulez en ligne sur le site officiel Chevening avant la date limite",
          officialLink: "https://www.chevening.org/apply",
        },
      }),
      {
        frTitle: "Bourse Chevening du gouvernement britannique",
        frSummary: "Financement complet pour un master d'un an au Royaume-Uni.",
        htSummary: "Bous pou yon mastè yon ane nan Wayòm Ini a.",
      },
    ),
    "scholarship", "Full scholarship (all fields)",
  );

  // Scenario 11: Scholarship with English eligibility (should be filtered)
  auditPayload(
    buildScholarshipCarousel(
      makeItem({
        title: "Bourse de la Banque Mondiale pour les pays en développement",
        summary: "Programme de bourses pour étudiants des pays en développement souhaitant poursuivre un master.",
        category: "scholarship",
        deadline: "2026-04-15",
        opportunity: {
          deadline: "2026-04-15",
          eligibility: [
            "Must be a citizen of a developing country eligible for World Bank funding",
            "Applicants should have at least 3 years of professional experience",
            "Must submit a letter of recommendation from current employer",
          ],
          coverage: "Full tuition + monthly stipend",
          howToApply: "Submit your application form online through the World Bank scholarship portal",
          officialLink: "https://www.worldbank.org/scholarships",
        },
      }),
    ),
    "scholarship", "English eligibility (French fallback)",
  );

  // Scenario 12: Scholarship with many eligibility items (overflow test)
  auditPayload(
    buildScholarshipCarousel(
      makeItem({
        title: "Programme de bourses universitaires",
        summary: "Programme offrant des bourses complètes.",
        category: "scholarship",
        deadline: "2026-06-30",
        opportunity: {
          deadline: "2026-06-30",
          eligibility: [
            "Être âgé de 18 à 30 ans",
            "Avoir un diplôme de licence",
            "Maîtriser le français",
            "Avoir une expérience de bénévolat",
            "Fournir deux lettres de recommandation",
            "Soumettre un projet de recherche",
            "Avoir un GPA minimum de 3.0",
            "Être en bonne santé physique et mentale",
          ],
          coverage: "Frais de scolarité complets",
        },
      }),
    ),
    "scholarship", "8 eligibility items (multi-slide split)",
  );

  // ════════════════════════════════════════════════════════════════════════
  // OPPORTUNITY FORMATTER
  // ════════════════════════════════════════════════════════════════════════

  // Scenario 13: Full opportunity
  auditPayload(
    buildOpportunityCarousel(
      makeItem({
        title: "Programme de stages à la Commission Européenne pour jeunes diplômés haïtiens",
        summary: "La Commission Européenne offre des stages rémunérés de 5 mois à Bruxelles pour les jeunes diplômés du monde entier.",
        category: "opportunity",
        deadline: "2026-08-31",
        geoTag: "HT",
        opportunity: {
          deadline: "2026-08-31",
          eligibility: [
            "Être titulaire d'un diplôme universitaire",
            "Maîtriser au moins 2 langues officielles de l'UE",
            "N'avoir jamais effectué de stage dans une institution européenne",
          ],
          coverage: "Allocation mensuelle de 1 300 €",
          howToApply: "Postulez via le portail EU Careers avant la date limite",
          officialLink: "https://traineeships.ec.europa.eu",
        },
      }),
      {
        frTitle: "Stages rémunérés à la Commission Européenne",
        frSummary: "Stages de 5 mois à Bruxelles pour jeunes diplômés.",
        htSummary: "Estaj 5 mwa nan Brisèl pou jèn diplome yo.",
      },
    ),
    "opportunity", "Full opportunity (EU traineeships)",
  );

  // Scenario 14: Opportunity with no eligibility/howToApply
  auditPayload(
    buildOpportunityCarousel(
      makeItem({
        title: "Conférence internationale sur l'éducation en Haïti",
        summary: "Une conférence internationale sur l'avenir de l'éducation en Haïti aura lieu le mois prochain à Port-au-Prince.",
        category: "opportunity",
        opportunity: {},
      }),
    ),
    "opportunity", "Minimal opportunity (no eligibility/apply)",
  );

  // ════════════════════════════════════════════════════════════════════════
  // UTILITY FORMATTER
  // ════════════════════════════════════════════════════════════════════════

  // Scenario 15: Utility with extracted facts
  auditPayload(
    buildUtilityCarousel(
      makeItem({
        title: "Guide : Comment postuler à Campus France depuis Haïti",
        summary: "Guide complet des étapes pour postuler aux universités françaises via Campus France depuis Haïti.",
        category: "resource",
        utilityMeta: {
          series: "StudyAbroad",
          utilityType: "study_abroad",
          citations: [{ label: "Campus France", url: "https://www.campusfrance.org" }],
          extractedFacts: {
            deadlines: [
              { label: "Inscription Campus France", dateISO: "2026-03-15", sourceUrl: "https://campusfrance.org" },
              { label: "Dépôt dossier DAP", dateISO: "2026-01-15", sourceUrl: "https://campusfrance.org" },
            ],
            steps: [
              "Créer un compte sur Études en France",
              "Remplir le formulaire en ligne",
              "Payer les frais de dossier (75 €)",
              "Passer l'entretien pédagogique",
            ],
            requirements: [
              "Diplôme de baccalauréat ou équivalent",
              "Test de français (TCF/DELF B2 minimum)",
            ],
            notes: [
              "L'entretien se fait à l'Espace Campus France de Port-au-Prince",
              "Prévoir 4 à 6 mois pour le traitement du dossier",
              "Le visa étudiant est demandé après l'acceptation",
            ],
          },
        },
      }),
    ),
    "utility", "Full utility with extracted facts",
  );

  // Scenario 16: Utility with no facts (minimal)
  auditPayload(
    buildUtilityCarousel(
      makeItem({
        title: "Taux de change du jour — 12 mars 2026",
        summary: "USD/HTG: 132.50 | EUR/HTG: 143.20 | CAD/HTG: 95.80",
        category: "resource",
      }),
    ),
    "utility", "Minimal utility (taux, no facts)",
  );

  // ════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ════════════════════════════════════════════════════════════════════════

  // Scenario 17: News with scraping junk in extractedText
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "Le gouvernement lance un programme de réforme éducative",
        summary: "Le ministère de l'Éducation nationale a annoncé un vaste programme de réforme du système éducatif haïtien.",
        extractedText: "Le gouvernement lance un programme de réforme éducative. Le ministère de l'Éducation a présenté son plan. Prévenez-moi de tous les nouveaux articles par e-mail. Enregistrer mon nom dans le navigateur pour mon prochain commentaire. Laisser un commentaire Annuler la réponse. Le programme vise à moderniser les écoles. Partager sur Facebook. Partager sur Twitter. Articles similaires. À lire aussi: Les universités haïtiennes en crise.",
        geoTag: "HT",
      }),
    ),
    "news", "Scraping junk in extractedText",
  );

  // Scenario 18: News with empty summary and empty extractedText
  auditPayload(
    buildNewsCarousel(
      makeItem({
        title: "Événement diplomatique à Port-au-Prince",
        summary: "",
        extractedText: "",
      }),
    ),
    "news", "Empty summary + empty extractedText",
  );

  // Scenario 19: Histoire with empty sections content
  auditPayload(
    buildHistoireCarousel(
      makeItem({
        title: "Un fait historique important",
        summary: "Un événement clé de l'histoire haïtienne.",
        utilityMeta: {
          series: "HaitiFactOfTheDay",
          utilityType: "daily_fact",
          citations: [],
        },
      }),
      {
        frTitle: "Un fait historique important",
        frSummary: "Un événement clé de l'histoire haïtienne.",
        frSections: [
          { heading: "L'histoire", content: "Short." }, // too short, should be filtered
          { heading: "Contexte", content: "" }, // empty
          { heading: "Sources", content: "Wikipedia, Britannica" }, // source section, should be filtered
        ],
      },
    ),
    "histoire", "Empty/tiny/source sections (edge case)",
  );

  // Scenario 20: Scholarship with very long title
  auditPayload(
    buildScholarshipCarousel(
      makeItem({
        title: "Programme de bourses d'excellence du gouvernement français en partenariat avec l'Agence Universitaire de la Francophonie pour les étudiants haïtiens poursuivant des études de master en sciences, technologie, ingénierie et mathématiques dans les universités françaises",
        summary: "Bourse complète pour master STEM en France.",
        category: "scholarship",
        deadline: "2026-09-15",
        opportunity: {
          deadline: "2026-09-15",
          eligibility: ["Être haïtien", "Avoir une licence en STEM"],
          coverage: "Frais complets + allocation",
        },
      }),
    ),
    "scholarship", "Very long title (headline overflow test)",
  );

  // ════════════════════════════════════════════════════════════════════════
  // REPORT
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passedTests}/${totalTests} scenarios clean`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (issues.length === 0) {
    console.log("✅ All scenarios passed — no issues found!\n");
  } else {
    const criticals = issues.filter((i) => i.severity === "🔴 CRITICAL");
    const warnings = issues.filter((i) => i.severity === "🟠 WARNING");
    const infos = issues.filter((i) => i.severity === "🟡 INFO");

    if (criticals.length > 0) {
      console.log(`\n🔴 CRITICAL ISSUES (${criticals.length}):`);
      console.log("─".repeat(60));
      for (const i of criticals) {
        console.log(`\n  [${i.formatter}] ${i.scenario}`);
        console.log(`  ${i.message}`);
      }
    }

    if (warnings.length > 0) {
      console.log(`\n🟠 WARNINGS (${warnings.length}):`);
      console.log("─".repeat(60));
      for (const i of warnings) {
        console.log(`\n  [${i.formatter}] ${i.scenario}`);
        console.log(`  ${i.message}`);
      }
    }

    if (infos.length > 0) {
      console.log(`\n🟡 INFO (${infos.length}):`);
      console.log("─".repeat(60));
      for (const i of infos) {
        console.log(`\n  [${i.formatter}] ${i.scenario}`);
        console.log(`  ${i.message}`);
      }
    }

    console.log("\n");
  }

  // ════════════════════════════════════════════════════════════════════════
  // DETAILED OUTPUT DUMP — show what each formatter actually produces
  // ════════════════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DETAILED SLIDE OUTPUT (spot-check)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Dump the OEA/Haiti news scenario
  const oea = buildNewsCarousel(
    makeItem({
      title: "L'OEA envoie une mission d'évaluation en Haïti",
      summary: "L'OEA a décidé d'envoyer une mission en Haïti.",
      geoTag: "HT",
      extractedText: "L'OEA a décidé d'envoyer une mission en Haïti. La décision a été prise lors de la session extraordinaire. L'organisation veut évaluer la situation sécuritaire. Les membres ont voté à l'unanimité.",
    }),
    {
      frTitle: "L'OEA envoie une mission d'évaluation en Haïti",
      frSummary: "L'OEA a décidé d'envoyer une mission d'évaluation en Haïti.",
      frSections: [
        { heading: "Ce qui s'est passé", content: "L'Organisation des États Américains a voté l'envoi d'une mission d'évaluation en Haïti lors d'une session extraordinaire de son conseil permanent." },
        { heading: "Contexte", content: "Haïti fait face à une crise sécuritaire sans précédent, avec des gangs armés contrôlant une partie de Port-au-Prince." },
        { heading: "Prochaines étapes", content: "La mission devrait arriver en Haïti dans les prochaines semaines et produire un rapport avec des recommandations." },
      ],
    },
  );
  dumpPayload("news (OEA/Haiti — sections)", oea);

  // Dump the repetitive-article news scenario
  const repetitive = buildNewsCarousel(
    makeItem({
      title: "Le Premier Ministre rencontre le Secrétaire Général de l'ONU",
      summary: "Le Premier Ministre haïtien a rencontré le Secrétaire Général de l'ONU pour discuter de la situation en Haïti.",
      geoTag: "HT",
      extractedText: "Le Premier Ministre haïtien a rencontré le Secrétaire Général des Nations Unies à New York. Lors de cette rencontre, le Premier Ministre a discuté de la situation sécuritaire en Haïti. Le chef du gouvernement haïtien a demandé une aide internationale renforcée pour faire face à la crise. Le Secrétaire Général de l'ONU a exprimé sa préoccupation concernant la situation en Haïti. Il a promis de mobiliser la communauté internationale pour aider Haïti. Le Premier Ministre a également sollicité un soutien pour les élections à venir.",
    }),
  );
  dumpPayload("news (Repetitive article — no sections)", repetitive);

  // Dump histoire
  const hist = buildHistoireCarousel(
    makeItem({
      title: "Jean-Jacques Dessalines : le père fondateur",
      summary: "Dessalines est le héros de l'indépendance haïtienne.",
      imageUrl: "https://example.com/dessalines.jpg",
      utilityMeta: {
        series: "HaitiHistory",
        utilityType: "history",
        citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org" }],
      },
    }),
    {
      frTitle: "Jean-Jacques Dessalines : le père fondateur",
      frSummary: "Dessalines est le héros de l'indépendance.",
      frSections: [
        { heading: "L'histoire", content: "Né en esclavage vers 1758, Dessalines s'est élevé pour devenir le principal artisan de l'indépendance d'Haïti." },
        { heading: "Contexte", content: "Saint-Domingue était la colonie la plus riche des Caraïbes, fondée sur l'esclavage." },
        { heading: "L'indépendance", content: "Le 1er janvier 1804, Dessalines proclame l'indépendance d'Haïti à Gonaïves." },
      ],
    },
  );
  dumpPayload("histoire (Dessalines — sections)", hist);

  return issues.filter((i) => i.severity === "🔴 CRITICAL").length > 0 ? 1 : 0;
}

function dumpPayload(label: string, payload: IGFormattedPayload) {
  console.log(`── ${label} ──`);
  for (let i = 0; i < payload.slides.length; i++) {
    const s = payload.slides[i]!;
    console.log(`  Slide ${i + 1} [${s.layout}]:`);
    if (s.heading) console.log(`    H: "${s.heading.slice(0, 100)}${s.heading.length > 100 ? '…' : ''}"`);
    if (s.bullets?.length) {
      for (const b of s.bullets) {
        console.log(`    • "${b.slice(0, 90)}${b.length > 90 ? '…' : ''}"`);
      }
    }
    if (s.statValue) console.log(`    STAT: ${s.statValue}`);
    if (s.footer) console.log(`    Footer: "${s.footer.slice(0, 80)}"`);
  }
  console.log(`  Caption (${payload.caption.length} chars): "${payload.caption.slice(0, 120)}…"\n`);
}

const exitCode = runAll();
process.exit(exitCode);
