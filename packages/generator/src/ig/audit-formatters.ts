#!/usr/bin/env tsx
/**
 * IG Formatter Audit v2 — Pixel-Accurate Quality Gate
 *
 * Exercises every formatter with 30 scenarios against actual renderer CSS
 * constraints from ig-carousel.ts + design-tokens.ts.
 *
 * PIXEL BUDGETS (1080×1350 canvas, Inter font):
 *
 *   HEADLINE layout  (.main max-height = calc(100% - 80px) = 1270px)
 *     Heading:  responsive font (88/72/64/56/48px), wt 900, LH 1.05
 *     Body .bt: 34px, LH 1.45  — first(clamp 3, max 150px) inner(clamp 6, max 320px)
 *     Bottom bar ~41px (16px padding-top + 15px src font + 10px flex)
 *
 *   EXPLANATION layout  (usable ~925px)
 *     padding: 120 top, 140 bottom, pill 44px, bottom-bar 41px, main pad 80px
 *     .h:  64px, wt 800, LH 1.10, clamp 4, mb 36px  → max ~318px
 *     .bt: 34px, wt 400, LH 1.50, clamp 8, max-height 420px, mb 20px
 *     Bullet text width: 876px  (900 − 24px border+padding)
 *
 *   DATA layout
 *     .stat: 120px wt 900 centered
 *     .stat-desc: 34px, max-width 80% = 720px
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

// ── Minimal Timestamp mock ─────────────────────────────────────────────────
const Timestamp = {
  now: () => ({
    seconds: Math.floor(Date.now() / 1000), nanoseconds: 0,
    toDate: () => new Date(), toMillis: () => Date.now(),
    isEqual: () => true, valueOf: () => "",
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// RENDERER CONSTANTS  (mirrors design-tokens.ts + ig-carousel.ts CSS)
// ═══════════════════════════════════════════════════════════════════════════

const CANVAS = { width: 1080, height: 1350 };
const MARGIN = { top: 120, side: 90, bottom: 100 };
const USABLE_W = CANVAS.width - 2 * MARGIN.side; // 900

const TYPE = { headlineHero: 88, headlineInner: 64, body: 34, stat: 120 };

// Approximate px-per-char multipliers for Inter font (weight-adjusted)
const CW = { hero: 0.55, inner: 0.55, body: 0.48, stat: 0.65 };

const MAX_CAPTION = 2200;

// ── Headline layout pixel budget ───────────────────────────────────────────

function hlFont(heading: string, first: boolean): number {
  if (first) return heading.length > 60 ? 64 : heading.length > 40 ? 72 : TYPE.headlineHero;
  return heading.length > 120 ? 48 : heading.length > 80 ? 56 : TYPE.headlineInner;
}
function hlClamp(heading: string, first: boolean): number {
  if (first) return heading.length > 60 ? 6 : 5;
  return heading.length > 120 ? 8 : 6;
}
const HL_LH = 1.05;
const HL_MAIN_MAX = CANVAS.height - 80; // calc(100% - 80px) = 1270
const HL_BT_LH = 1.45;
const HL_BOT = 41; // bottom bar approx

function hlCpl(font: number): number { return Math.floor(USABLE_W / (font * CW.hero)); }
function bodyCpl(): number { return Math.floor(USABLE_W / (TYPE.body * CW.body)); }

// ── Explanation layout pixel budget ────────────────────────────────────────
// Canvas 1350 − top 120 − bottom-pad 140 − pill ~44 − bottom-bar 41 − main top/bottom pad 80
const EXPL_AVAIL = CANVAS.height - MARGIN.top - 140 - 44 - HL_BOT - 80; // ~925

const EH_FONT = 64; const EH_LH = 1.10; const EH_CLAMP = 4; const EH_MB = 36;
const EB_FONT = 34; const EB_LH = 1.50; const EB_CLAMP = 8; const EB_MAX_H = 420; const EB_MB = 20;
const EXPL_BW = USABLE_W - 24; // 876 (border-left 6 + padding-left 18)

function ehCpl(): number { return Math.floor(USABLE_W / (EH_FONT * CW.inner)); }
function ebCpl(): number { return Math.floor(EXPL_BW / (EB_FONT * CW.body)); }

function explHeadPx(h: string): number {
  const lines = Math.min(Math.ceil(h.length / ehCpl()), EH_CLAMP);
  return lines * EH_FONT * EH_LH + EH_MB;
}
function explBulletPx(b: string): number {
  const lines = Math.min(Math.ceil(b.length / ebCpl()), EB_CLAMP);
  return Math.min(lines * EB_FONT * EB_LH, EB_MAX_H) + EB_MB;
}

// ── Data layout ────────────────────────────────────────────────────────────
function statCpl(): number { return Math.floor(USABLE_W / (TYPE.stat * CW.stat)); }

// ═══════════════════════════════════════════════════════════════════════════
// SIMILARITY / LANGUAGE / JUNK
// ═══════════════════════════════════════════════════════════════════════════

const STOP = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "en", "est", "sont",
  "dans", "pour", "par", "avec", "sur", "qui", "que", "ce", "cette", "au", "aux",
  "se", "ne", "pas", "a", "à", "été", "il", "elle", "ils", "ont", "son", "sa",
  "ses", "leurs", "mais", "ou", "où", "aussi", "plus", "très", "tout", "tous",
  "the", "of", "and", "to", "in", "is", "for", "that", "on", "was",
]);

function cWords(t: string): Set<string> {
  return new Set(
    t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function jac(a: string, b: string): number {
  const sa = cWords(a), sb = cWords(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

const EN = [
  /\bmust be\b/i, /\bshould be\b/i, /\bapplicants?\b/i, /\brequired\b/i,
  /\bsubmit\b/i, /\byou must\b/i, /\beligible\b/i, /\bcitizens? of\b/i,
  /\bopen to\b/i, /\bapplication form\b/i, /\bscholarship\b/i,
];

function enLeak(t: string): boolean {
  if (!t || t.length < 15) return false;
  let h = 0;
  for (const r of EN) { if (r.test(t)) h++; if (h >= 2) return true; }
  return false;
}

const JUNK = [
  /cookie/i, /prévenez-moi/i, /enregistrer mon nom/i,
  /laisser un commentaire/i, /insert_random/i, /zoneid=/i,
  /<img\s/i, /<a\s/i, /\.php/i, /\.aspx/i,
];

function hasJunk(t: string): boolean { return JUNK.some((p) => p.test(t)); }

// ═══════════════════════════════════════════════════════════════════════════
// ISSUE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

type Sev = "🔴 CRITICAL" | "🟠 WARNING" | "🟡 INFO";
interface Issue { severity: Sev; formatter: string; scenario: string; message: string }

const issues: Issue[] = [];
let total = 0;
let passed = 0;

function rpt(s: Sev, f: string, sc: string, m: string) {
  issues.push({ severity: s, formatter: f, scenario: sc, message: m });
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT ENGINE — checks every dimension per slide
// ═══════════════════════════════════════════════════════════════════════════

function slideText(s: IGSlide): string {
  return [s.heading ?? "", ...(s.bullets ?? [])].join(" ").trim();
}

function audit(res: IGFormattedPayload, fmt: string, scen: string) {
  total++;
  const { slides, caption } = res;
  let bad = false;
  const flag = (s: Sev, m: string) => { rpt(s, fmt, scen, m); bad = true; };

  // ── 1. Slide count ──────────────────────────────────────────────────────
  if (slides.length === 0) flag("🔴 CRITICAL", "Zero slides produced");
  if (slides.length === 1) flag("🟠 WARNING", "Only 1 slide (just cover, no content)");
  if (slides.length > 10) flag("🔴 CRITICAL", `${slides.length} slides (IG max 10)`);

  // ── 2. Duplicate slides (Jaccard) ───────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    for (let j = i + 1; j < slides.length; j++) {
      const a = slideText(slides[i]!);
      const b = slideText(slides[j]!);
      const sim = jac(a, b);
      if (sim > 0.55)
        flag("🔴 CRITICAL",
          `Slides ${i + 1}&${j + 1} near-dup (J=${sim.toFixed(2)})\n` +
          `    "${a.slice(0, 80)}…"\n    "${b.slice(0, 80)}…"`);
      else if (sim > 0.40)
        flag("🟠 WARNING", `Slides ${i + 1}&${j + 1} high overlap (J=${sim.toFixed(2)})`);
    }
  }

  // ── 3. Empty slides / blank bullets ─────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i]!;
    if (!sl.heading && (!sl.bullets?.length) && !sl.statValue)
      flag("🔴 CRITICAL", `Slide ${i + 1} is completely empty`);
    for (let b = 0; b < (sl.bullets?.length ?? 0); b++) {
      if (!sl.bullets![b]?.trim())
        flag("🟠 WARNING", `Slide ${i + 1} bullet ${b + 1} is blank`);
    }
  }

  // ── 4. HEADLINE layout pixel overflow ───────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i]!;
    const lay = sl.layout ?? (i === 0 ? "headline" : "explanation");
    if (lay !== "headline" || !sl.heading) continue;
    const first = i === 0;
    const hf = hlFont(sl.heading, first);
    const hc = hlClamp(sl.heading, first);
    const cpl = hlCpl(hf);
    const estLines = Math.ceil(sl.heading.length / cpl);

    if (estLines > hc)
      flag("🟠 WARNING",
        `Slide ${i + 1} heading clips (~${estLines} lines > clamp ${hc}, ${hf}px): ` +
        `"${sl.heading.slice(0, 55)}…"`);

    // Vertical budget: accent-rule + heading + body + bottom-bar
    const hPx = Math.min(estLines, hc) * hf * HL_LH + (first ? 24 : 28);
    let btPx = 0;
    const bc = bodyCpl();
    for (const b of sl.bullets ?? []) {
      const bl = Math.ceil(b.length / bc);
      const mh = first ? 150 : 320;
      const cl = first ? 3 : 6;
      btPx += Math.min(Math.min(bl, cl) * TYPE.body * HL_BT_LH, mh) + 8;
    }
    const tot = (first ? 24 : 0) + hPx + btPx + HL_BOT;
    if (tot > HL_MAIN_MAX)
      flag("🔴 CRITICAL",
        `Slide ${i + 1} headline overflow: ~${Math.round(tot)}px > ${HL_MAIN_MAX}px`);
  }

  // ── 5. EXPLANATION layout pixel overflow ────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i]!;
    const lay = sl.layout ?? (i === 0 ? "headline" : "explanation");
    if (lay !== "explanation") continue;

    const hPx = sl.heading ? explHeadPx(sl.heading) : 0;
    let btPx = 0;
    for (const b of sl.bullets ?? []) btPx += explBulletPx(b);
    const tot = hPx + btPx;

    if (tot > EXPL_AVAIL)
      flag("🔴 CRITICAL",
        `Slide ${i + 1} explanation overflow: ~${Math.round(tot)}px > ${EXPL_AVAIL}px ` +
        `(head=${Math.round(hPx)}, bullets×${sl.bullets?.length ?? 0}=${Math.round(btPx)})`);
    else if (tot > EXPL_AVAIL * 0.92)
      flag("🟠 WARNING",
        `Slide ${i + 1} explanation tight: ~${Math.round(tot)}px / ${EXPL_AVAIL}px ` +
        `(${Math.round(tot / EXPL_AVAIL * 100)}%)`);

    // Individual bullet clipping check
    const ec = ebCpl();
    for (let b = 0; b < (sl.bullets?.length ?? 0); b++) {
      const bl = sl.bullets![b]!;
      if (Math.ceil(bl.length / ec) > EB_CLAMP)
        flag("🟠 WARNING",
          `Slide ${i + 1} bullet ${b + 1} clips (>${EB_CLAMP} lines): "${bl.slice(0, 60)}…"`);
    }

    // Explanation heading clipping
    if (sl.heading && Math.ceil(sl.heading.length / ehCpl()) > EH_CLAMP)
      flag("🟠 WARNING",
        `Slide ${i + 1} expl heading clips (>${EH_CLAMP} lines): "${sl.heading.slice(0, 50)}…"`);
  }

  // ── 6. DATA layout stat text ────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i]!;
    if (sl.layout !== "data") continue;
    const sv = sl.statValue ?? sl.heading;
    if (sv && sv.length > statCpl() * 1.5)
      flag("🟠 WARNING",
        `Slide ${i + 1} stat text long (${sv.length} chars): "${sv.slice(0, 40)}…"`);
  }

  // ── 7. Source attribution ──────────────────────────────────────────────
  const last = slides[slides.length - 1];
  if (last && !last.footer)
    flag("🟠 WARNING", "Last slide missing source footer");

  // ── 8. Caption quality ─────────────────────────────────────────────────
  if (caption.length > MAX_CAPTION)
    flag("🔴 CRITICAL", `Caption ${caption.length} > ${MAX_CAPTION}`);
  if (caption.length < 80)
    flag("🟠 WARNING", `Caption only ${caption.length} chars`);
  if (!caption.includes("lien dans la bio") && !caption.includes("lyen nan biyo"))
    flag("🟠 WARNING", "Caption missing CTA (lien dans la bio)");
  if (!/#\w+/.test(caption))
    rpt("🟡 INFO", fmt, scen, "No hashtags in caption");

  // ── 9. English leak ────────────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const t = slideText(slides[i]!);
    if (enLeak(t))
      flag("🟠 WARNING", `Slide ${i + 1} English leak: "${t.slice(0, 80)}…"`);
  }

  // ── 10. Junk artifacts ─────────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    if (hasJunk(slideText(slides[i]!)))
      flag("🔴 CRITICAL", `Slide ${i + 1} scraping junk`);
  }
  if (hasJunk(caption))
    flag("🟠 WARNING", "Caption contains junk");

  if (!bad) passed++;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA FACTORY
// ═══════════════════════════════════════════════════════════════════════════

const NOW = Timestamp.now();

function mk(ov: Partial<Item>): Item {
  return {
    id: "t-1", rawItemId: "r-1", sourceId: "s-1",
    title: "Titre par défaut", summary: "Résumé par défaut de l'article.",
    canonicalUrl: "https://example.com/a", category: "news",
    deadline: null, evergreen: false, confidence: 0.85,
    qualityFlags: { hasSourceUrl: true, needsReview: false, lowConfidence: false, reasons: [] },
    citations: [{ sourceName: "Le Nouvelliste", sourceUrl: "https://lenouvelliste.com/t" }],
    source: { name: "Le Nouvelliste", originalUrl: "https://lenouvelliste.com/t" },
    createdAt: NOW, updatedAt: NOW,
    ...ov,
  } as Item;
}

// ═══════════════════════════════════════════════════════════════════════════
// 30 SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

function runAll() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  IG FORMATTER AUDIT v2 — Pixel-Accurate Quality Gate");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ────────────────────────────────────────────────────────────────────────
  // NEWS  (8 scenarios)
  // ────────────────────────────────────────────────────────────────────────

  // 1. Rich sections (OEA/Haiti)
  audit(
    buildNewsCarousel(
      mk({
        title: "L'OEA envoie une mission d'évaluation en Haïti pour la crise sécuritaire",
        summary: "L'Organisation des États Américains a décidé d'envoyer une mission d'évaluation en Haïti.",
        geoTag: "HT", imageUrl: "https://img.test/oea.jpg",
        extractedText: "L'OEA a décidé d'envoyer une mission en Haïti. La décision a été prise lors de la session extraordinaire du conseil permanent.",
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
    "news", "1 — Rich sections (OEA/Haiti)",
  );

  // 2. No sections, repetitive extractedText
  audit(
    buildNewsCarousel(
      mk({
        title: "Le Premier Ministre rencontre le Secrétaire Général de l'ONU",
        summary: "Le Premier Ministre haïtien a rencontré le Secrétaire Général de l'ONU pour discuter de la situation en Haïti et demander une aide internationale renforcée.",
        geoTag: "HT",
        extractedText: "Le Premier Ministre haïtien a rencontré le Secrétaire Général des Nations Unies à New York. Lors de cette rencontre, le Premier Ministre a discuté de la situation sécuritaire en Haïti. Le chef du gouvernement haïtien a demandé une aide internationale renforcée pour faire face à la crise. Le Secrétaire Général de l'ONU a exprimé sa préoccupation concernant la situation en Haïti. Il a promis de mobiliser la communauté internationale pour aider Haïti.",
      }),
    ),
    "news", "2 — No sections, repetitive text",
  );

  // 3. Summary-only
  audit(
    buildNewsCarousel(
      mk({
        title: "Séisme de magnitude 4.2 ressenti dans le Nord d'Haïti",
        summary: "Un séisme de magnitude 4.2 a été ressenti dans le département du Nord d'Haïti ce matin. Aucune victime n'a été signalée pour le moment. Les autorités surveillent la situation.",
        geoTag: "HT",
      }),
    ),
    "news", "3 — Summary-only",
  );

  // 4. English extractedText (should fallback to French summary)
  audit(
    buildNewsCarousel(
      mk({
        title: "Les États-Unis annoncent un nouveau programme d'aide pour Haïti",
        summary: "Les États-Unis ont annoncé un programme d'aide humanitaire de 50 millions de dollars pour Haïti, visant à renforcer la sécurité alimentaire.",
        extractedText: "The United States announced a new humanitarian aid program for Haiti worth $50 million. The program aims to strengthen food security and health infrastructure. Secretary of State confirmed the commitment during a press conference.",
        geoTag: "HT",
      }),
    ),
    "news", "4 — English extractedText (FR fallback)",
  );

  // 5. Very long headline
  audit(
    buildNewsCarousel(
      mk({
        title: "Le Conseil de Sécurité des Nations Unies adopte une nouvelle résolution autorisant le déploiement d'une force multinationale de sécurité en Haïti pour lutter contre les gangs armés et rétablir l'ordre public dans la capitale",
        summary: "Le Conseil de Sécurité a voté à l'unanimité pour le déploiement.",
        geoTag: "HT",
      }),
    ),
    "news", "5 — Very long headline",
  );

  // 6. Five long Gemini sections (max content test)
  audit(
    buildNewsCarousel(
      mk({
        title: "Crise alimentaire : le PAM lance un appel d'urgence pour Haïti",
        summary: "Le Programme Alimentaire Mondial a lancé un appel d'urgence.",
        geoTag: "HT", imageUrl: "https://img.test/pam.jpg",
      }),
      {
        frTitle: "Crise alimentaire : le PAM lance un appel d'urgence pour Haïti",
        frSummary: "Le Programme Alimentaire Mondial a lancé un appel d'urgence pour financer l'aide alimentaire en Haïti.",
        frSections: [
          { heading: "L'appel d'urgence", content: "Le Programme Alimentaire Mondial des Nations Unies a lancé un appel d'urgence de 200 millions de dollars pour financer l'aide alimentaire en Haïti. Selon le directeur régional du PAM, plus de 4,7 millions de personnes font face à une insécurité alimentaire aiguë dans le pays, dont 1,6 million en situation d'urgence. L'organisation prévoit de fournir des rations alimentaires à 2 millions de personnes au cours des six prochains mois." },
          { heading: "Contexte humanitaire", content: "La situation humanitaire en Haïti s'est considérablement dégradée au cours des derniers mois. Les gangs armés bloquent les axes routiers principaux, empêchant l'acheminement de l'aide humanitaire vers les populations les plus vulnérables. Les prix des denrées alimentaires de base ont augmenté de 40% en un an, rendant la nourriture inaccessible." },
          { heading: "Réponse internationale", content: "Plusieurs pays donateurs ont déjà promis des contributions. La France a annoncé 15 millions d'euros, le Canada 20 millions de dollars canadiens, et l'Union européenne 30 millions d'euros. Cependant, le PAM estime que ces engagements ne couvrent que 30% des besoins identifiés." },
          { heading: "Défis logistiques", content: "L'acheminement de l'aide reste le principal défi. Les routes principales reliant Port-au-Prince aux provinces sont régulièrement bloquées par des groupes armés. Le PAM travaille avec les forces de sécurité pour identifier des corridors humanitaires sûrs et explore l'utilisation de voies maritimes alternatives." },
          { heading: "Perspectives", content: "Sans un financement adéquat et rapide, le PAM prévient que la situation pourrait devenir catastrophique d'ici la fin de l'année. L'organisation appelle la communauté internationale à agir de toute urgence pour éviter une famine à grande échelle en Haïti." },
        ],
      },
    ),
    "news", "6 — 5 long sections (max content)",
  );

  // 7. Scraping junk in extractedText
  audit(
    buildNewsCarousel(
      mk({
        title: "Le gouvernement lance un programme de réforme éducative",
        summary: "Le ministère de l'Éducation nationale a annoncé un vaste programme de réforme du système éducatif haïtien.",
        extractedText: "Le gouvernement lance un programme de réforme éducative. Le ministère de l'Éducation a présenté son plan. Prévenez-moi de tous les nouveaux articles par e-mail. Enregistrer mon nom dans le navigateur. Laisser un commentaire Annuler la réponse. Le programme vise à moderniser les écoles. Partager sur Facebook.",
        geoTag: "HT",
      }),
    ),
    "news", "7 — Scraping junk",
  );

  // 8. Empty summary + empty extractedText
  audit(
    buildNewsCarousel(
      mk({ title: "Événement diplomatique à Port-au-Prince", summary: "", extractedText: "" }),
    ),
    "news", "8 — Empty summary+text",
  );

  // ────────────────────────────────────────────────────────────────────────
  // HISTOIRE  (5 scenarios)
  // ────────────────────────────────────────────────────────────────────────

  // 9. Rich sections (HaitiHistory)
  audit(
    buildHistoireCarousel(
      mk({
        title: "Jean-Jacques Dessalines : le père fondateur d'Haïti",
        summary: "Jean-Jacques Dessalines est le héros de l'indépendance haïtienne.",
        imageUrl: "https://img.test/dessalines.jpg",
        utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org" }] },
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
    "histoire", "9 — Rich sections (Dessalines)",
  );

  // 10. No sections (legacy fallback)
  audit(
    buildHistoireCarousel(
      mk({
        title: "La citadelle Laferrière : un monument de la liberté",
        summary: "La citadelle Laferrière est la plus grande forteresse des Amériques, construite après l'indépendance d'Haïti pour protéger le pays.",
        extractedText: "La citadelle Laferrière, aussi connue sous le nom de Citadelle Henry, est une grande forteresse située sur le sommet de la montagne Bonnet à l'Évêque, dans le Nord d'Haïti. Construite entre 1805 et 1820 sur ordre du roi Henri Christophe, elle est la plus grande forteresse des Amériques. La citadelle a été classée patrimoine mondial de l'UNESCO en 1982. Elle pouvait abriter jusqu'à 5 000 soldats et contenir des provisions pour résister à un siège d'un an.",
        imageUrl: "https://img.test/citadelle.jpg",
        utilityMeta: { series: "HaitiFactOfTheDay", utilityType: "daily_fact", citations: [{ label: "UNESCO", url: "https://whc.unesco.org" }] },
      }),
    ),
    "histoire", "10 — No sections (legacy)",
  );

  // 11. HaitianOfTheWeek with sections
  audit(
    buildHistoireCarousel(
      mk({
        title: "Michaëlle Jean : de réfugiée haïtienne à Gouverneure générale du Canada",
        summary: "Michaëlle Jean est une journaliste et diplomate haïtiano-canadienne remarquable.",
        imageUrl: "https://img.test/jean.jpg",
        utilityMeta: { series: "HaitianOfTheWeek", utilityType: "profile", citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org" }] },
      }),
      {
        frTitle: "Michaëlle Jean : de réfugiée haïtienne à Gouverneure générale du Canada",
        frSummary: "Michaëlle Jean est une journaliste et diplomate haïtiano-canadienne remarquable.",
        htSummary: "Michaëlle Jean se yon jounalis ak diplomat ayisyano-kanadyèn remakab.",
        frSections: [
          { heading: "Parcours", content: "Née à Port-au-Prince en 1957, Michaëlle Jean a fui la dictature des Duvalier avec sa famille à l'âge de 11 ans. Installée au Canada, elle a poursuivi des études en littérature comparée à l'Université de Montréal." },
          { heading: "Carrière journalistique", content: "Elle a été journaliste et animatrice à Radio-Canada et CBC, couvrant des sujets de société et de droits humains pendant plus de 15 ans. Son travail journalistique a mis en lumière les réalités des communautés marginalisées." },
          { heading: "Gouverneure générale", content: "En 2005, elle est devenue la 27e Gouverneure générale du Canada, la première personne noire et d'origine haïtienne à occuper ce poste. Son mandat a duré jusqu'en 2010." },
          { heading: "Héritage", content: "Après son mandat, elle a été nommée Secrétaire générale de l'Organisation internationale de la Francophonie de 2015 à 2019. Elle reste un symbole de résilience et de réussite pour la diaspora haïtienne." },
        ],
      },
    ),
    "histoire", "11 — HaitianOfTheWeek",
  );

  // 12. Empty/tiny/source sections (edge case)
  audit(
    buildHistoireCarousel(
      mk({
        title: "Un fait historique important",
        summary: "Un événement clé de l'histoire haïtienne qui mérite d'être connu par tous les Haïtiens.",
        utilityMeta: { series: "HaitiFactOfTheDay", utilityType: "daily_fact", citations: [] },
      }),
      {
        frTitle: "Un fait historique important",
        frSummary: "Un événement clé de l'histoire haïtienne qui mérite d'être connu par tous les Haïtiens.",
        frSections: [
          { heading: "L'histoire", content: "Short." },
          { heading: "Contexte", content: "" },
          { heading: "Sources", content: "Wikipedia, Britannica" },
        ],
      },
    ),
    "histoire", "12 — Empty/tiny/source sections",
  );

  // 13. Very long section content (overflow stress test)
  audit(
    buildHistoireCarousel(
      mk({
        title: "La Révolution haïtienne : l'événement qui a changé le monde",
        summary: "La Révolution haïtienne reste l'un des événements les plus importants de l'histoire mondiale.",
        imageUrl: "https://img.test/rev.jpg",
        utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Britannica", url: "https://britannica.com" }] },
      }),
      {
        frTitle: "La Révolution haïtienne : l'événement qui a changé le monde",
        frSummary: "La Révolution haïtienne reste l'un des événements les plus importants de l'histoire mondiale.",
        frSections: [
          { heading: "Les origines", content: "La révolte des esclaves de Saint-Domingue a commencé le 22 août 1791 lors de la cérémonie du Bois Caïman, un événement fondateur qui a rassemblé des milliers d'esclaves déterminés à briser les chaînes de l'oppression coloniale française qui durait depuis plus de deux siècles dans la colonie la plus riche des Caraïbes et du monde occidental." },
          { heading: "Les batailles décisives", content: "Sous la direction de Toussaint Louverture puis de Jean-Jacques Dessalines, les combattants haïtiens ont affronté et vaincu successivement les armées françaises, espagnoles et britanniques, démontrant une capacité militaire et stratégique extraordinaire qui a surpris les puissances coloniales européennes habituées à dominer sans résistance les populations asservies des Amériques." },
          { heading: "La proclamation", content: "Le 1er janvier 1804, à Gonaïves, Jean-Jacques Dessalines proclame solennellement l'indépendance d'Haïti, créant ainsi la première république noire libre au monde, un acte révolutionnaire d'une portée historique immense qui a définitivement remis en question le système esclavagiste international et l'idéologie de la supériorité raciale sur laquelle reposait l'ordre colonial européen." },
          { heading: "L'impact mondial", content: "La Révolution haïtienne a eu des conséquences géopolitiques majeures, notamment la vente de la Louisiane par Napoléon aux États-Unis, l'inspiration des mouvements d'indépendance en Amérique latine menés par Simón Bolívar qui a reçu le soutien direct du président haïtien Alexandre Pétion, et l'accélération du mouvement abolitionniste mondial qui a conduit à l'abolition de l'esclavage dans les empires coloniaux européens au cours du XIXe siècle." },
        ],
      },
    ),
    "histoire", "13 — Very long sections (overflow test)",
  );

  // ────────────────────────────────────────────────────────────────────────
  // SCHOLARSHIP  (6 scenarios)
  // ────────────────────────────────────────────────────────────────────────

  // 14. Full scholarship (all fields)
  audit(
    buildScholarshipCarousel(
      mk({
        title: "Bourse Chevening du gouvernement britannique pour les étudiants haïtiens",
        summary: "La bourse Chevening offre un financement complet pour un master d'un an au Royaume-Uni.",
        category: "scholarship", deadline: "2026-11-01", geoTag: "HT",
        imageUrl: "https://img.test/chev.jpg",
        opportunity: {
          deadline: "2026-11-01",
          eligibility: [
            "Être citoyen d'un pays éligible (incluant Haïti)",
            "Avoir au moins 2 ans d'expérience professionnelle",
            "Avoir un diplôme de licence (baccalauréat + 4 ans)",
            "Maîtriser l'anglais (IELTS 6.5 minimum)",
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
    "scholarship", "14 — Full scholarship",
  );

  // 15. English eligibility (French fallback expected)
  audit(
    buildScholarshipCarousel(
      mk({
        title: "Bourse de la Banque Mondiale pour les pays en développement",
        summary: "Programme de bourses pour étudiants des pays en développement souhaitant poursuivre un master.",
        category: "scholarship", deadline: "2026-04-15",
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
    "scholarship", "15 — English eligibility",
  );

  // 16. 8 eligibility items (multi-slide split)
  audit(
    buildScholarshipCarousel(
      mk({
        title: "Programme de bourses universitaires",
        summary: "Programme offrant des bourses complètes aux meilleurs étudiants.",
        category: "scholarship", deadline: "2026-06-30",
        opportunity: {
          deadline: "2026-06-30",
          eligibility: [
            "Être âgé de 18 à 30 ans",
            "Avoir un diplôme de licence",
            "Maîtriser le français couramment",
            "Avoir une expérience de bénévolat significative",
            "Fournir deux lettres de recommandation de professeurs",
            "Soumettre un projet de recherche détaillé",
            "Avoir un GPA minimum de 3.0 sur 4.0",
            "Être en bonne santé physique et mentale",
          ],
          coverage: "Frais de scolarité complets + allocation de vie",
        },
      }),
    ),
    "scholarship", "16 — 8 eligibility (split)",
  );

  // 17. Very long title
  audit(
    buildScholarshipCarousel(
      mk({
        title: "Programme de bourses d'excellence du gouvernement français en partenariat avec l'Agence Universitaire de la Francophonie pour les étudiants haïtiens poursuivant des études de master en sciences, technologie, ingénierie et mathématiques",
        summary: "Bourse complète pour master STEM en France.",
        category: "scholarship", deadline: "2026-09-15",
        opportunity: {
          deadline: "2026-09-15",
          eligibility: ["Être haïtien", "Avoir une licence en STEM"],
          coverage: "Frais complets + allocation",
        },
      }),
    ),
    "scholarship", "17 — Very long title",
  );

  // 18. No deadline, minimal fields
  audit(
    buildScholarshipCarousel(
      mk({
        title: "Bourse d'études disponible",
        summary: "Nouvelle bourse d'études pour les jeunes haïtiens motivés et talentueux.",
        category: "scholarship",
        opportunity: { eligibility: ["Être haïtien"] },
      }),
    ),
    "scholarship", "18 — No deadline, minimal",
  );

  // 19. 5 long eligibility items (pixel overflow test)
  audit(
    buildScholarshipCarousel(
      mk({
        title: "Bourse complète pour études supérieures",
        summary: "Programme de bourses offrant un financement complet pour les étudiants les plus méritants.",
        category: "scholarship", deadline: "2026-12-01",
        opportunity: {
          deadline: "2026-12-01",
          eligibility: [
            "Les candidats doivent être titulaires d'un diplôme de licence ou équivalent délivré par une université reconnue internationalement dans le domaine d'études visé",
            "Les postulants doivent justifier d'au moins trois années d'expérience professionnelle pertinente dans un secteur en lien direct avec le programme de master choisi",
            "Une maîtrise avérée de la langue française est exigée, attestée par un certificat officiel de type DELF B2 ou TCF niveau 4 minimum obtenu dans les deux dernières années",
            "Les candidats doivent fournir un projet de recherche détaillé d'au moins cinq pages décrivant leurs objectifs académiques et leur plan de carrière après l'obtention du diplôme",
            "Un engagement formel de retour dans le pays d'origine pour au moins deux ans après la fin des études est requis, attesté par une lettre signée par le candidat",
          ],
          coverage: "Frais de scolarité + logement + transport",
        },
      }),
    ),
    "scholarship", "19 — 5 long eligibility (overflow test)",
  );

  // ────────────────────────────────────────────────────────────────────────
  // OPPORTUNITY  (4 scenarios)
  // ────────────────────────────────────────────────────────────────────────

  // 20. Full opportunity
  audit(
    buildOpportunityCarousel(
      mk({
        title: "Programme de stages à la Commission Européenne pour jeunes diplômés haïtiens",
        summary: "La Commission Européenne offre des stages rémunérés de 5 mois à Bruxelles.",
        category: "opportunity", deadline: "2026-08-31", geoTag: "HT",
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
    "opportunity", "20 — Full opportunity (EU)",
  );

  // 21. Minimal opportunity (no eligibility/apply)
  audit(
    buildOpportunityCarousel(
      mk({
        title: "Conférence internationale sur l'éducation en Haïti",
        summary: "Une conférence internationale sur l'avenir de l'éducation en Haïti aura lieu le mois prochain.",
        category: "opportunity",
        opportunity: {},
      }),
    ),
    "opportunity", "21 — Minimal (no elig/apply)",
  );

  // 22. English howToApply + long eligibility
  audit(
    buildOpportunityCarousel(
      mk({
        title: "Programme de formation professionnelle au Canada",
        summary: "Formation de 6 mois au Canada pour les jeunes professionnels haïtiens dans le domaine de la technologie.",
        category: "opportunity", deadline: "2026-07-15",
        opportunity: {
          deadline: "2026-07-15",
          eligibility: [
            "Être âgé de 21 à 35 ans et être titulaire d'un diplôme universitaire en informatique ou dans un domaine connexe",
            "Avoir au moins deux années d'expérience professionnelle dans le secteur technologique avec des références vérifiables",
            "Démontrer une maîtrise fonctionnelle de l'anglais par un score IELTS de 6.0 minimum ou équivalent reconnu",
            "Présenter un plan de carrière détaillé expliquant comment cette formation contribuera au développement technologique en Haïti",
          ],
          howToApply: "You must submit your application online through the official portal and include all required documents",
          officialLink: "https://canada.ca/training",
        },
      }),
    ),
    "opportunity", "22 — EN howToApply + long elig",
  );

  // 23. Very long coverage text (data slide stress)
  audit(
    buildOpportunityCarousel(
      mk({
        title: "Bourse complète du gouvernement japonais",
        summary: "Le gouvernement japonais offre une bourse complète pour études au Japon.",
        category: "opportunity", deadline: "2026-05-01",
        opportunity: {
          deadline: "2026-05-01",
          eligibility: ["Être haïtien", "Avoir moins de 35 ans"],
          coverage: "Frais de scolarité complets + allocation mensuelle de 143 000 yens + billet d'avion aller-retour + logement universitaire gratuit + assurance maladie",
          howToApply: "Postulez à l'ambassade du Japon en Haïti",
          officialLink: "https://www.studyinjapan.go.jp",
        },
      }),
    ),
    "opportunity", "23 — Long coverage (data slide)",
  );

  // ────────────────────────────────────────────────────────────────────────
  // UTILITY  (4 scenarios)
  // ────────────────────────────────────────────────────────────────────────

  // 24. Full utility with facts
  audit(
    buildUtilityCarousel(
      mk({
        title: "Guide : Comment postuler à Campus France depuis Haïti",
        summary: "Guide complet des étapes pour postuler aux universités françaises via Campus France depuis Haïti.",
        category: "resource",
        utilityMeta: {
          series: "StudyAbroad", utilityType: "study_abroad",
          citations: [{ label: "Campus France", url: "https://campusfrance.org" }],
          extractedFacts: {
            deadlines: [
              { label: "Inscription Campus France", dateISO: "2026-03-15", sourceUrl: "https://campusfrance.org" },
              { label: "Dépôt dossier DAP", dateISO: "2026-01-15", sourceUrl: "https://campusfrance.org" },
            ],
            steps: ["Créer un compte sur Études en France", "Remplir le formulaire en ligne", "Payer les frais de dossier (75 €)", "Passer l'entretien pédagogique"],
            requirements: ["Diplôme de baccalauréat ou équivalent", "Test de français (TCF/DELF B2 minimum)"],
            notes: ["L'entretien se fait à l'Espace Campus France de Port-au-Prince", "Prévoir 4 à 6 mois pour le traitement du dossier", "Le visa étudiant est demandé après l'acceptation"],
          },
        },
      }),
    ),
    "utility", "24 — Full utility with facts",
  );

  // 25. Minimal utility (no facts)
  audit(
    buildUtilityCarousel(
      mk({
        title: "Taux de change du jour — 12 mars 2026",
        summary: "USD/HTG: 132.50 | EUR/HTG: 143.20 | CAD/HTG: 95.80",
        category: "resource",
      }),
    ),
    "utility", "25 — Minimal (taux, no facts)",
  );

  // 26. Many facts (>5 bullets → split)
  audit(
    buildUtilityCarousel(
      mk({
        title: "Rentrée scolaire 2026 : dates et informations essentielles",
        summary: "Tout ce qu'il faut savoir pour la rentrée scolaire en Haïti.",
        category: "resource",
        utilityMeta: {
          series: "HaitiEducationCalendar", utilityType: "school_calendar",
          citations: [{ label: "MENFP", url: "https://menfp.gouv.ht" }],
          extractedFacts: {
            deadlines: [
              { label: "Rentrée scolaire", dateISO: "2026-09-02", sourceUrl: "https://menfp.gouv.ht" },
              { label: "Inscriptions", dateISO: "2026-08-15", sourceUrl: "https://menfp.gouv.ht" },
              { label: "Examens officiels", dateISO: "2026-06-10", sourceUrl: "https://menfp.gouv.ht" },
            ],
            requirements: ["Certificat de naissance", "Bulletin scolaire de l'année précédente", "Certificat médical à jour"],
            steps: ["Vérifier les dates d'inscription", "Préparer les documents requis", "Se rendre à l'école choisie"],
            notes: ["Les frais de scolarité varient selon les établissements", "Le transport scolaire n'est pas garanti"],
          },
        },
      }),
    ),
    "utility", "26 — Many facts (split)",
  );

  // 27. Unicode/emoji in title
  audit(
    buildUtilityCarousel(
      mk({
        title: "🇭🇹 Jou Drapo — Fête du Drapeau haïtien 🇭🇹",
        summary: "Le 18 mai, Haïti célèbre la création de son drapeau national bicolore bleu et rouge.",
        category: "resource",
      }),
    ),
    "utility", "27 — Unicode/emoji title",
  );

  // ────────────────────────────────────────────────────────────────────────
  // CROSS-FORMATTER EDGE CASES  (3 scenarios)
  // ────────────────────────────────────────────────────────────────────────

  // 28. News — single-sentence summary identical to title
  audit(
    buildNewsCarousel(
      mk({
        title: "Haïti : le gouvernement annonce un couvre-feu à Port-au-Prince",
        summary: "Le gouvernement a annoncé un couvre-feu à Port-au-Prince.",
        geoTag: "HT",
      }),
    ),
    "news", "28 — Summary restates title",
  );

  // 29. News — section heading restates cover heading
  audit(
    buildNewsCarousel(
      mk({
        title: "La BRH maintient le taux directeur à 12%",
        summary: "La Banque de la République d'Haïti maintient son taux directeur inchangé.",
        geoTag: "HT",
      }),
      {
        frTitle: "La BRH maintient le taux directeur à 12%",
        frSummary: "La Banque de la République d'Haïti maintient son taux directeur inchangé.",
        frSections: [
          { heading: "La BRH maintient le taux directeur", content: "La Banque de la République d'Haïti a annoncé le maintien de son taux directeur à 12%, conformément aux attentes du marché." },
          { heading: "Contexte économique", content: "L'inflation a ralenti au cours du dernier trimestre, passant de 25% à 22%, permettant à la banque centrale de maintenir sa politique monétaire stable." },
        ],
      },
    ),
    "news", "29 — Section restates cover heading",
  );

  // 30. News — all-junk extractedText (should fall back cleanly to summary)
  audit(
    buildNewsCarousel(
      mk({
        title: "Nouveau centre de santé inauguré dans le Sud",
        summary: "Un nouveau centre de santé communautaire a été inauguré dans le département du Sud d'Haïti grâce à un financement de l'UNICEF.",
        extractedText: "Laisser un commentaire Annuler la réponse. Prévenez-moi de tous les nouveaux articles. Enregistrer mon nom dans le navigateur. Articles similaires. Partager sur Facebook. Partager sur Twitter. cookies politique de confidentialité.",
        geoTag: "HT",
      }),
    ),
    "news", "30 — All-junk extractedText",
  );

  // ────────────────────────────────────────────────────────────────────────
  // WORST-CASE STRESS TESTS  (validate fixes cover ALL real-world data)
  // ────────────────────────────────────────────────────────────────────────

  // 31. Histoire — 5 sections with max-length content (tests 3-bullet cap)
  audit(
    buildHistoireCarousel(
      mk({
        title: "Les origines du mouvement noiriste en Haïti et son influence sur la politique caribéenne moderne",
        summary: "Le mouvement noiriste a profondément transformé la politique haïtienne depuis les années 1930.",
        imageUrl: "https://img.test/noirisme.jpg",
        utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Le Nouvelliste", url: "https://lenouvelliste.com" }] },
      }),
      {
        frTitle: "Le mouvement noiriste en Haïti",
        frSummary: "Le mouvement noiriste a profondément transformé la politique haïtienne.",
        frSections: [
          { heading: "Les origines intellectuelles du mouvement", content: "Le mouvement noiriste trouve ses racines dans les écrits de Jean Price-Mars, notamment son ouvrage majeur Ainsi parla l'Oncle publié en 1928. Ce texte fondateur a profondément remis en question l'aliénation culturelle de l'élite haïtienne et a encouragé un retour aux traditions africaines et au vodou comme expressions culturelles légitimes du peuple haïtien." },
          { heading: "L'ascension politique et ses conséquences", content: "François Duvalier a instrumentalisé l'idéologie noiriste pour consolider son pouvoir politique à partir de 1957. En se présentant comme le champion de la majorité noire face à l'élite mulâtre, il a transformé un mouvement intellectuel en un outil de domination politique qui a conduit à l'une des dictatures les plus brutales de l'hémisphère occidental." },
          { heading: "L'héritage contemporain dans la Caraïbe", content: "L'influence du noirisme dépasse les frontières haïtiennes et continue d'alimenter les débats sur l'identité raciale dans l'ensemble de la Caraïbe francophone. Les travaux d'Aimé Césaire et de Frantz Fanon, bien que distincts, partagent des préoccupations similaires avec le mouvement haïtien sur la négritude et la décolonisation mentale." },
          { heading: "Critiques et réévaluations académiques", content: "Les historiens contemporains portent un regard plus nuancé sur le mouvement noiriste, reconnaissant à la fois sa contribution à la valorisation de la culture africaine en Haïti et les dérives autoritaires auxquelles il a conduit. Le débat reste vif dans les universités haïtiennes entre ceux qui voient dans le noirisme un mouvement de libération et ceux qui le considèrent comme un instrument de division sociale et politique." },
          { heading: "Sources et références historiques", content: "Price-Mars Jean, Ainsi parla l'Oncle, 1928. Nicholls David, From Dessalines to Duvalier: Race, Colour and National Independence in Haiti, 1979." },
        ],
      },
    ),
    "histoire", "31 — 5 long sections (stress test 3-bullet cap)",
  );

  // 32. Utility — 9 long mixed bullets (tests split at 4 + truncation)
  audit(
    buildUtilityCarousel(
      mk({
        title: "Guide complet de la rentrée scolaire 2026-2027 en Haïti",
        summary: "Toutes les informations essentielles pour préparer la rentrée scolaire en Haïti.",
        category: "resource",
        utilityMeta: {
          series: "HaitiEducationCalendar", utilityType: "school_calendar",
          citations: [{ label: "MENFP", url: "https://menfp.gouv.ht" }],
          extractedFacts: {
            deadlines: [
              { label: "Rentrée des classes dans les écoles fondamentales et secondaires publiques et privées", dateISO: "2026-09-07", sourceUrl: "https://menfp.gouv.ht" },
              { label: "Date limite d'inscription tardive pour les élèves transférés d'un autre département", dateISO: "2026-09-21", sourceUrl: "https://menfp.gouv.ht" },
              { label: "Début des examens officiels de 9ème année fondamentale dans tout le territoire national", dateISO: "2027-06-14", sourceUrl: "https://menfp.gouv.ht" },
            ],
            requirements: [
              "Certificat de naissance original ou copie certifiée conforme délivrée par les autorités compétentes de la commune de résidence de l'élève, accompagné de deux photos d'identité récentes format passeport",
              "Bulletin scolaire de l'année précédente portant le cachet et la signature du directeur de l'établissement scolaire fréquenté, avec relevé de notes complet pour chaque matière",
              "Certificat médical de moins de trois mois attestant que l'enfant est en bonne santé et à jour de ses vaccinations obligatoires selon le calendrier du Ministère de la Santé Publique",
            ],
            steps: [
              "Se rendre à l'école choisie avec l'ensemble des documents requis pendant la période d'inscription officielle fixée par le calendrier du MENFP pour l'année scolaire en cours",
              "Remplir le formulaire d'inscription fourni par l'établissement et le soumettre au secrétariat avec les pièces justificatives complètes et les frais d'inscription correspondants",
              "Attendre la confirmation d'admission par courrier ou affichage à l'école dans un délai de quinze jours ouvrables suivant la soumission du dossier complet",
            ],
            notes: [
              "Les familles en situation de vulnérabilité économique peuvent bénéficier du programme de subvention scolaire du gouvernement haïtien qui prend en charge les frais de scolarité dans les écoles publiques fondamentales pour les enfants de 6 à 15 ans issus de milieux défavorisés",
              "Le port de l'uniforme scolaire est obligatoire dans tous les établissements publics et privés du territoire national conformément à l'arrêté ministériel du MENFP publié en août 2024",
              "Les parents d'élèves sont invités à participer aux réunions d'information organisées par les directions d'école avant la rentrée pour prendre connaissance du règlement intérieur",
            ],
          },
        },
      }),
      {
        frTitle: "Guide de la rentrée scolaire 2026-2027",
        frSummary: "Toutes les informations pour préparer la rentrée en Haïti.",
      },
    ),
    "utility", "32 — 9 long bullets + 3 long notes (stress test)",
  );

  // 33. Scholarship — very long howToApply text (tests truncation)
  audit(
    buildScholarshipCarousel(
      mk({
        title: "Bourse Fulbright pour études de master aux États-Unis",
        summary: "Le programme Fulbright offre des bourses complètes pour des études de master dans les universités américaines.",
        category: "scholarship", deadline: "2026-10-15",
        opportunity: {
          deadline: "2026-10-15",
          eligibility: ["Être citoyen haïtien résidant en Haïti", "Détenir un diplôme de licence"],
          coverage: "Frais de scolarité + allocation mensuelle",
          howToApply: "Les candidats doivent d'abord créer un compte sur le portail officiel Fulbright à l'adresse apply.iie.org/fulbright, puis compléter le formulaire de candidature en ligne en incluant leur relevé de notes universitaire, trois lettres de recommandation de professeurs ou employeurs, un essai personnel de 800 mots décrivant leurs objectifs académiques et professionnels, un plan d'études détaillé pour le programme de master choisi, ainsi qu'un certificat de compétence en anglais (TOEFL iBT score minimum 80 ou IELTS 6.5). Les dossiers incomplets ne seront pas examinés par le comité de sélection. Les candidats présélectionnés seront convoqués pour un entretien en personne à l'ambassade des États-Unis à Port-au-Prince.",
          officialLink: "https://apply.iie.org/fulbright",
        },
      }),
    ),
    "scholarship", "33 — Very long howToApply (stress test)",
  );

  // 34. Opportunity — long howToApply + 6 eligibility items
  audit(
    buildOpportunityCarousel(
      mk({
        title: "Programme de stages à l'Organisation des Nations Unies pour les jeunes professionnels haïtiens",
        summary: "L'ONU recrute des stagiaires pour ses bureaux de New York et Genève.",
        category: "opportunity", deadline: "2026-07-31", geoTag: "HT",
        opportunity: {
          deadline: "2026-07-31",
          eligibility: [
            "Être inscrit dans un programme de master ou de doctorat dans une université reconnue internationalement",
            "Maîtriser couramment au moins deux des six langues officielles des Nations Unies dont obligatoirement l'anglais ou le français",
            "N'avoir aucun lien de parenté directe avec un employé actuel du système des Nations Unies à quelque niveau que ce soit",
            "Posséder une assurance médicale couvrant la durée complète du stage dans le pays d'affectation choisi par le candidat",
            "Avoir obtenu une moyenne cumulative d'au moins 3.0 sur 4.0 ou l'équivalent dans le système de notation de l'université fréquentée",
            "Être disponible à temps plein pour une période minimale de deux mois consécutifs dans les bureaux de l'ONU",
          ],
          howToApply: "Rendez-vous sur careers.un.org, créez votre profil Inspira, puis recherchez les offres de stage correspondant à votre domaine d'études. Soumettez votre candidature en ligne avec votre CV, lettre de motivation, relevés de notes et deux lettres de recommandation académiques avant la date limite indiquée dans l'offre. Les candidats retenus seront contactés par le département concerné pour un entretien téléphonique ou vidéo.",
          officialLink: "https://careers.un.org/",
        },
      }),
      {
        frTitle: "Stages à l'ONU pour jeunes Haïtiens",
        frSummary: "L'ONU recrute des stagiaires pour New York et Genève.",
      },
    ),
    "opportunity", "34 — Long howToApply + 6 eligibility",
  );

  // 35. News — very long section heading from AI
  audit(
    buildNewsCarousel(
      mk({
        title: "Crise alimentaire dans le Nord-Ouest",
        summary: "Une crise alimentaire frappe le département du Nord-Ouest d'Haïti.",
        geoTag: "HT", imageUrl: "https://img.test/famine.jpg",
      }),
      {
        frTitle: "Crise alimentaire dans le Nord-Ouest d'Haïti",
        frSummary: "Une crise alimentaire sévère affecte les populations du département du Nord-Ouest.",
        frSections: [
          { heading: "Ce qui se passe actuellement dans le département du Nord-Ouest d'Haïti selon les dernières données du Programme Alimentaire Mondial", content: "Le PAM a classé le département du Nord-Ouest en phase 4 de l'IPC, signalant une urgence alimentaire." },
          { heading: "Contexte", content: "Les récoltes ont été détruites par les intempéries successives de la saison cyclonique 2025." },
        ],
      },
    ),
    "news", "35 — Very long section heading from AI",
  );

  // ────────────────────────────────────────────────────────────────────────
  // HISTOIRE RICHNESS TESTS (validate takeaway extraction + LLM sub-sections)
  // ────────────────────────────────────────────────────────────────────────

  // 36. Template path — section content has inline 💡 takeaway + 📚 sources
  audit(
    buildHistoireCarousel(
      mk({
        title: "L'indépendance d'Haïti : 1er janvier 1804",
        summary: "Haïti devient la première république noire indépendante au monde.",
        imageUrl: "https://img.test/independance.jpg",
        utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org" }] },
      }),
      {
        frTitle: "L'indépendance d'Haïti (1804)",
        frSummary: "Haïti devient la première république noire indépendante.",
        htSummary: "Ayiti vin premye repiblik nwa endepandan nan monn nan.",
        frSections: [
          {
            heading: "L'indépendance d'Haïti (1804)",
            content: "Le 1er janvier 1804, Jean-Jacques Dessalines proclame l'indépendance d'Haïti à Gonaïves, faisant du pays la première république noire indépendante au monde. Cet acte historique a mis fin à plus de trois siècles de colonisation française et au système esclavagiste le plus brutal des Amériques.\n\n💡 **Pour les étudiants :** L'indépendance d'Haïti a prouvé que la liberté est un droit universel, pas un privilège réservé à certains peuples. Cette victoire a inspiré des mouvements de libération dans toute l'Amérique latine et le monde.\n\n📚 Sources : [Wikipedia](https://fr.wikipedia.org/wiki/Haiti) · [Britannica](https://britannica.com/place/haiti)",
          },
          {
            heading: "Bataille de Vertières (1803)",
            content: "La bataille de Vertières du 18 novembre 1803 fut la victoire décisive des forces haïtiennes contre l'armée de Napoléon Bonaparte. Sous le commandement de Jean-Jacques Dessalines, les troupes haïtiennes ont vaincu le corps expéditionnaire français du général Rochambeau.\n\n💡 **Pour les étudiants :** Vertières montre que la détermination et le courage peuvent triompher contre une armée considérée comme invincible. C'est une leçon de résilience pour tous les Haïtiens.\n\n📚 Sources : [UNESCO](https://whc.unesco.org) · [Le Nouvelliste](https://lenouvelliste.com)",
          },
        ],
      },
    ),
    "histoire", "36 — Template path (💡 takeaway + 📚 sources inline)",
  );

  // 37. LLM-rewrite path — section content has **bold** sub-headings + ### headers
  audit(
    buildHistoireCarousel(
      mk({
        title: "La cérémonie du Bois Caïman : naissance de la révolution haïtienne",
        summary: "La cérémonie vaudou du Bois Caïman en 1791 a lancé la révolution haïtienne.",
        imageUrl: "https://img.test/bois-caiman.jpg",
        utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Britannica", url: "https://britannica.com" }] },
      }),
      {
        frTitle: "La cérémonie du Bois Caïman (1791)",
        frSummary: "La cérémonie vaudou du Bois Caïman a lancé la révolution.",
        htSummary: "Seremoni Bwa Kayiman an te kòmanse revolisyon ayisyen an.",
        frSections: [
          {
            heading: "La cérémonie du Bois Caïman (1791)",
            content: "### L'événement fondateur\n\nDans la nuit du 14 août 1791, des centaines d'esclaves se sont rassemblés secrètement dans une clairière du Bois Caïman, dans le nord de Saint-Domingue. Sous la direction du prêtre vaudou Dutty Boukman et de la prêtresse Cécile Fatiman, ils ont prêté serment de renverser le système esclavagiste.\n\n### Le contexte colonial\n\nSaint-Domingue était la colonie la plus riche de France, produisant la moitié du sucre et du café consommés en Europe. Ce système reposait sur l'exploitation brutale de plus de 500 000 esclaves africains qui travaillaient dans des conditions inhumaines sur les plantations.\n\n### Pourquoi cela compte\n\nLe Bois Caïman n'était pas simplement une révolte : c'était un acte de résistance spirituelle et politique qui a donné naissance à la plus grande révolution d'esclaves réussie de l'histoire. Son héritage continue d'inspirer les mouvements de libération dans le monde entier.\n\n### Questions pour la discussion\n\nPourquoi le vodou a-t-il joué un rôle si important dans l'organisation de la résistance des esclaves ? Comment le Bois Caïman a-t-il changé le cours de l'histoire mondiale ?",
          },
        ],
      },
    ),
    "histoire", "37 — LLM path (### sub-sections + **Pourquoi cela compte**)",
  );

  // 38. LLM path with **bold** paragraph headings (no ### markers)
  audit(
    buildHistoireCarousel(
      mk({
        title: "Toussaint Louverture : le Napoléon noir des Caraïbes",
        summary: "Toussaint Louverture, ancien esclave devenu général, a transformé Saint-Domingue.",
        imageUrl: "https://img.test/toussaint.jpg",
        utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Britannica", url: "https://britannica.com" }] },
      }),
      {
        frTitle: "Toussaint Louverture : le Napoléon noir",
        frSummary: "Toussaint Louverture a transformé Saint-Domingue en une puissance militaire.",
        frSections: [
          {
            heading: "Toussaint Louverture (1743–1803)",
            content: "**L'ascension d'un ancien esclave** — Né en esclavage vers 1743 sur la plantation Bréda, Toussaint a appris à lire et à monter à cheval. Affranchi vers l'âge de 33 ans, il a rapidement montré des talents militaires et diplomatiques exceptionnels.\n\n**Le stratège militaire** — En quelques années, Toussaint a unifié les forces rebelles de Saint-Domingue, vaincu les armées espagnoles et britanniques, et rédigé une constitution qui abolissait définitivement l'esclavage dans la colonie.\n\n**La trahison de Napoléon** — En 1802, Napoléon Bonaparte a envoyé une expédition de 40 000 soldats pour rétablir l'esclavage. Toussaint a été capturé par ruse et emprisonné au Fort de Joux dans le Jura, où il est mort le 7 avril 1803.\n\n**Pourquoi cela compte** — Toussaint a prouvé qu'un ancien esclave pouvait surpasser les plus grands généraux européens. Ses idées de liberté et d'égalité ont inspiré des générations de leaders anticoloniaux dans le monde entier.",
          },
        ],
      },
    ),
    "histoire", "38 — LLM path (**bold** paragraph headings, no ###)",
  );

  // 39. Template path — 5 sections all with takeaways (tests slot reservation)
  audit(
    buildHistoireCarousel(
      mk({
        title: "Cinq dates clés de l'histoire d'Haïti",
        summary: "Cinq événements fondateurs de la nation haïtienne.",
        imageUrl: "https://img.test/timeline.jpg",
        utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org" }] },
      }),
      {
        frTitle: "Cinq dates clés de l'histoire d'Haïti",
        frSummary: "Cinq événements fondateurs de la nation haïtienne.",
        frSections: [
          { heading: "Bois Caïman (1791)", content: "La cérémonie vaudou du Bois Caïman a lancé la plus grande révolte d'esclaves réussie de l'histoire.\n\n💡 **Pour les étudiants :** Le Bois Caïman montre que la résistance spirituelle peut devenir un mouvement politique puissant.\n\n📚 Sources : [Wikipedia](https://fr.wikipedia.org)" },
          { heading: "Bataille de Vertières (1803)", content: "Les forces haïtiennes sous Dessalines ont vaincu l'armée de Napoléon lors de cette bataille décisive.\n\n💡 **Pour les étudiants :** Vertières a prouvé que le courage peut triompher contre la force militaire supérieure.\n\n📚 Sources : [Britannica](https://britannica.com)" },
          { heading: "Indépendance (1804)", content: "Le 1er janvier 1804, Haïti devient la première république noire indépendante au monde.\n\n💡 **Pour les étudiants :** L'indépendance d'Haïti a redéfini la notion de liberté universelle pour tous les peuples.\n\n📚 Sources : [UNESCO](https://whc.unesco.org)" },
          { heading: "Code Rural (1826)", content: "Le Code Rural de Boyer a imposé un système de travail forcé qui a freiné le développement économique du pays.\n\n💡 **Pour les étudiants :** Le Code Rural montre comment l'indépendance politique ne garantit pas toujours la liberté économique.\n\n📚 Sources : [JSTOR](https://jstor.org)" },
          { heading: "Occupation américaine (1915)", content: "Les États-Unis ont occupé Haïti pendant 19 ans, transformant ses institutions et son économie.\n\n💡 **Pour les étudiants :** L'occupation américaine illustre les dangers de l'ingérence étrangère dans la souveraineté nationale.\n\n📚 Sources : [Library of Congress](https://loc.gov)" },
        ],
      },
    ),
    "histoire", "39 — 5 sections all with 💡 takeaway (slot reservation test)",
  );

  // ════════════════════════════════════════════════════════════════════════
  // REPORT
  // ════════════════════════════════════════════════════════════════════════

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} scenarios clean`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const crits = issues.filter((i) => i.severity === "🔴 CRITICAL");
  const warns = issues.filter((i) => i.severity === "🟠 WARNING");
  const infos = issues.filter((i) => i.severity === "🟡 INFO");

  if (issues.length === 0) {
    console.log("✅ All scenarios passed — no issues!\n");
  } else {
    if (crits.length) {
      console.log(`\n🔴 CRITICAL (${crits.length}):`);
      console.log("─".repeat(60));
      for (const i of crits) console.log(`\n  [${i.formatter}] ${i.scenario}\n  ${i.message}`);
    }
    if (warns.length) {
      console.log(`\n🟠 WARNING (${warns.length}):`);
      console.log("─".repeat(60));
      for (const i of warns) console.log(`\n  [${i.formatter}] ${i.scenario}\n  ${i.message}`);
    }
    if (infos.length) {
      console.log(`\n🟡 INFO (${infos.length}):`);
      console.log("─".repeat(60));
      for (const i of infos) console.log(`\n  [${i.formatter}] ${i.scenario}\n  ${i.message}`);
    }
    console.log("\n");
  }

  // ════════════════════════════════════════════════════════════════════════
  // DETAILED SLIDE DUMP  (spot-check key scenarios)
  // ════════════════════════════════════════════════════════════════════════

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DETAILED SLIDE OUTPUT (spot-check)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Dump histoire long-sections scenario
  dump("histoire (long sections — #13)", buildHistoireCarousel(
    mk({
      title: "La Révolution haïtienne",
      summary: "La Révolution haïtienne reste un événement majeur.",
      imageUrl: "https://img.test/rev.jpg",
      utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Britannica", url: "https://britannica.com" }] },
    }),
    {
      frTitle: "La Révolution haïtienne",
      frSummary: "La Révolution haïtienne reste un événement majeur.",
      frSections: [
        { heading: "Origines", content: "La révolte des esclaves de Saint-Domingue a commencé le 22 août 1791 lors de la cérémonie du Bois Caïman." },
        { heading: "Batailles", content: "Sous la direction de Toussaint Louverture puis de Dessalines, les combattants ont vaincu les armées européennes." },
      ],
    },
  ));

  // Dump scholarship 5-long-eligibility
  dump("scholarship (5 long elig — #19)", buildScholarshipCarousel(
    mk({
      title: "Bourse complète pour études supérieures",
      summary: "Programme de bourses offrant un financement complet.",
      category: "scholarship", deadline: "2026-12-01",
      opportunity: {
        deadline: "2026-12-01",
        eligibility: [
          "Les candidats doivent être titulaires d'un diplôme de licence ou équivalent délivré par une université reconnue",
          "Les postulants doivent justifier d'au moins trois années d'expérience professionnelle dans un secteur pertinent",
          "Une maîtrise de la langue française est exigée, attestée par un certificat officiel DELF B2 ou TCF niveau 4",
          "Les candidats doivent fournir un projet de recherche détaillé décrivant leurs objectifs académiques et professionnels",
          "Un engagement de retour dans le pays d'origine pour au moins deux ans après les études est requis",
        ],
        coverage: "Frais complets",
      },
    }),
  ));

  // Dump news OEA/Haiti section scenario
  dump("news (OEA sections — #1)", buildNewsCarousel(
    mk({
      title: "L'OEA envoie une mission en Haïti",
      summary: "L'OEA a décidé d'envoyer une mission d'évaluation en Haïti.",
      geoTag: "HT", imageUrl: "https://img.test/oea.jpg",
    }),
    {
      frTitle: "L'OEA envoie une mission en Haïti",
      frSummary: "L'OEA a décidé d'envoyer une mission d'évaluation en Haïti.",
      frSections: [
        { heading: "Ce qui s'est passé", content: "L'Organisation des États Américains a voté l'envoi d'une mission d'évaluation en Haïti lors d'une session extraordinaire." },
        { heading: "Contexte", content: "Haïti fait face à une crise sécuritaire sans précédent, avec des gangs armés contrôlant une partie de Port-au-Prince." },
        { heading: "Prochaines étapes", content: "La mission devrait arriver en Haïti dans les prochaines semaines et produire un rapport avec des recommandations concrètes." },
      ],
    },
  ));

  // Dump utility stress test
  dump("utility (9 long bullets — #32)", buildUtilityCarousel(
    mk({
      title: "Guide complet de la rentrée scolaire 2026-2027 en Haïti",
      summary: "Toutes les informations essentielles pour préparer la rentrée scolaire en Haïti.",
      category: "resource",
      utilityMeta: {
        series: "HaitiEducationCalendar", utilityType: "school_calendar",
        citations: [{ label: "MENFP", url: "https://menfp.gouv.ht" }],
        extractedFacts: {
          deadlines: [
            { label: "Rentrée des classes publiques et privées", dateISO: "2026-09-07", sourceUrl: "https://menfp.gouv.ht" },
            { label: "Inscription tardive départementale", dateISO: "2026-09-21", sourceUrl: "https://menfp.gouv.ht" },
          ],
          requirements: [
            "Certificat de naissance original ou copie certifiée conforme délivrée par les autorités compétentes de la commune de résidence de l'élève, accompagné de deux photos d'identité format passeport",
            "Bulletin scolaire de l'année précédente portant le cachet et la signature du directeur de l'établissement scolaire fréquenté avec relevé de notes complet",
          ],
          steps: [
            "Se rendre à l'école choisie avec l'ensemble des documents requis pendant la période d'inscription officielle fixée par le calendrier du MENFP pour l'année en cours",
          ],
          notes: [
            "Les familles vulnérables peuvent bénéficier du programme de subvention scolaire du gouvernement haïtien prenant en charge les frais de scolarité dans les écoles publiques fondamentales",
          ],
        },
      },
    }),
    { frTitle: "Guide de la rentrée scolaire 2026-2027", frSummary: "Toutes les informations pour la rentrée." },
  ));

  // ── New: histoire richness scenarios ──────────────────────────────────

  // Dump #36 — Template path with inline takeaway + sources
  dump("histoire (template 💡+📚 — #36)", buildHistoireCarousel(
    mk({
      title: "L'indépendance d'Haïti : 1er janvier 1804",
      summary: "Haïti devient la première république noire indépendante au monde.",
      imageUrl: "https://img.test/independance.jpg",
      utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org" }] },
    }),
    {
      frTitle: "L'indépendance d'Haïti (1804)",
      frSummary: "Haïti devient la première république noire indépendante.",
      htSummary: "Ayiti vin premye repiblik nwa endepandan nan monn nan.",
      frSections: [
        {
          heading: "L'indépendance d'Haïti (1804)",
          content: "Le 1er janvier 1804, Jean-Jacques Dessalines proclame l'indépendance d'Haïti à Gonaïves, faisant du pays la première république noire indépendante au monde. Cet acte historique a mis fin à plus de trois siècles de colonisation française et au système esclavagiste le plus brutal des Amériques.\n\n💡 **Pour les étudiants :** L'indépendance d'Haïti a prouvé que la liberté est un droit universel, pas un privilège réservé à certains peuples. Cette victoire a inspiré des mouvements de libération dans toute l'Amérique latine et le monde.\n\n📚 Sources : [Wikipedia](https://fr.wikipedia.org/wiki/Haiti) · [Britannica](https://britannica.com/place/haiti)",
        },
        {
          heading: "Bataille de Vertières (1803)",
          content: "La bataille de Vertières du 18 novembre 1803 fut la victoire décisive des forces haïtiennes contre l'armée de Napoléon Bonaparte.\n\n💡 **Pour les étudiants :** Vertières montre que la détermination et le courage peuvent triompher contre une armée invincible.\n\n📚 Sources : [UNESCO](https://whc.unesco.org)",
        },
      ],
    },
  ));

  // Dump #37 — LLM path with ### sub-sections
  dump("histoire (LLM ### — #37)", buildHistoireCarousel(
    mk({
      title: "La cérémonie du Bois Caïman",
      summary: "La cérémonie vaudou du Bois Caïman en 1791 a lancé la révolution haïtienne.",
      imageUrl: "https://img.test/bois-caiman.jpg",
      utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Britannica", url: "https://britannica.com" }] },
    }),
    {
      frTitle: "La cérémonie du Bois Caïman (1791)",
      frSummary: "La cérémonie vaudou du Bois Caïman a lancé la révolution.",
      frSections: [
        {
          heading: "La cérémonie du Bois Caïman (1791)",
          content: "### L'événement fondateur\n\nDans la nuit du 14 août 1791, des centaines d'esclaves se sont rassemblés dans le Bois Caïman.\n\n### Le contexte colonial\n\nSaint-Domingue était la colonie la plus riche de France, produisant la moitié du sucre et du café d'Europe.\n\n### Pourquoi cela compte\n\nLe Bois Caïman n'était pas simplement une révolte : c'était un acte de résistance spirituelle et politique.\n\n### Questions pour la discussion\n\nPourquoi le vodou a-t-il joué un rôle si important ?",
        },
      ],
    },
  ));

  // Dump #38 — LLM path with **bold** paragraph headings
  dump("histoire (LLM **bold** — #38)", buildHistoireCarousel(
    mk({
      title: "Toussaint Louverture : le Napoléon noir",
      summary: "Toussaint Louverture, ancien esclave devenu général.",
      imageUrl: "https://img.test/toussaint.jpg",
      utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Britannica", url: "https://britannica.com" }] },
    }),
    {
      frTitle: "Toussaint Louverture : le Napoléon noir",
      frSummary: "Toussaint Louverture a transformé Saint-Domingue.",
      frSections: [
        {
          heading: "Toussaint Louverture (1743–1803)",
          content: "**L'ascension d'un ancien esclave** — Né en esclavage vers 1743, Toussaint a montré des talents militaires exceptionnels.\n\n**Le stratège militaire** — Il a unifié les forces rebelles, vaincu les armées espagnoles et britanniques.\n\n**La trahison de Napoléon** — En 1802, Napoléon a envoyé 40 000 soldats. Toussaint a été capturé et est mort au Fort de Joux.\n\n**Pourquoi cela compte** — Toussaint a prouvé qu'un ancien esclave pouvait surpasser les plus grands généraux européens.",
        },
      ],
    },
  ));

  // Dump #39 — 5 template sections with takeaways (slot reservation)
  dump("histoire (5 sections + takeaways — #39)", buildHistoireCarousel(
    mk({
      title: "Cinq dates clés de l'histoire d'Haïti",
      summary: "Cinq événements fondateurs de la nation haïtienne.",
      imageUrl: "https://img.test/timeline.jpg",
      utilityMeta: { series: "HaitiHistory", utilityType: "history", citations: [{ label: "Wikipedia", url: "https://fr.wikipedia.org" }] },
    }),
    {
      frTitle: "Cinq dates clés de l'histoire d'Haïti",
      frSummary: "Cinq événements fondateurs de la nation haïtienne.",
      frSections: [
        { heading: "Bois Caïman (1791)", content: "La cérémonie vaudou du Bois Caïman a lancé la plus grande révolte d'esclaves réussie de l'histoire.\n\n💡 **Pour les étudiants :** Le Bois Caïman montre que la résistance spirituelle peut devenir un mouvement politique puissant.\n\n📚 Sources : [Wikipedia](https://fr.wikipedia.org)" },
        { heading: "Bataille de Vertières (1803)", content: "Les forces haïtiennes sous Dessalines ont vaincu l'armée de Napoléon lors de cette bataille décisive.\n\n💡 **Pour les étudiants :** Vertières a prouvé que le courage peut triompher contre la force militaire supérieure.\n\n📚 Sources : [Britannica](https://britannica.com)" },
        { heading: "Indépendance (1804)", content: "Le 1er janvier 1804, Haïti devient la première république noire indépendante au monde.\n\n💡 **Pour les étudiants :** L'indépendance d'Haïti a redéfini la notion de liberté universelle pour tous les peuples.\n\n📚 Sources : [UNESCO](https://whc.unesco.org)" },
        { heading: "Code Rural (1826)", content: "Le Code Rural de Boyer a imposé un système de travail forcé qui a freiné le développement économique du pays.\n\n💡 **Pour les étudiants :** Le Code Rural montre comment l'indépendance politique ne garantit pas toujours la liberté économique.\n\n📚 Sources : [JSTOR](https://jstor.org)" },
        { heading: "Occupation américaine (1915)", content: "Les États-Unis ont occupé Haïti pendant 19 ans, transformant ses institutions et son économie.\n\n💡 **Pour les étudiants :** L'occupation américaine illustre les dangers de l'ingérence étrangère dans la souveraineté nationale.\n\n📚 Sources : [Library of Congress](https://loc.gov)" },
      ],
    },
  ));

  return crits.length > 0 ? 1 : 0;
}

function dump(label: string, p: IGFormattedPayload) {
  console.log(`── ${label} ──`);
  for (let i = 0; i < p.slides.length; i++) {
    const s = p.slides[i]!;
    const lay = s.layout ?? (i === 0 ? "headline" : "explanation");
    console.log(`  Slide ${i + 1} [${lay}]:`);
    if (s.heading) console.log(`    H: "${s.heading.slice(0, 100)}${s.heading.length > 100 ? "…" : ""}"`);
    if (s.bullets?.length) {
      for (const b of s.bullets)
        console.log(`    • "${b.slice(0, 90)}${b.length > 90 ? "…" : ""}"`);
    }
    if (s.statValue) console.log(`    STAT: ${s.statValue}`);
    if (s.footer) console.log(`    Footer: "${s.footer.slice(0, 80)}"`);

    // Pixel estimate for explanation slides
    if (lay === "explanation") {
      const hp = s.heading ? explHeadPx(s.heading) : 0;
      let bp = 0;
      for (const b of s.bullets ?? []) bp += explBulletPx(b);
      console.log(`    📐 ${Math.round(hp + bp)}px / ${EXPL_AVAIL}px (${Math.round((hp + bp) / EXPL_AVAIL * 100)}%)`);
    }
  }
  console.log(`  Caption: ${p.caption.length} chars\n`);
}

const exitCode = runAll();
process.exit(exitCode);
