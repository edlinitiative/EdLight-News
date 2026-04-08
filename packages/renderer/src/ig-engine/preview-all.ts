/**
 * IG Engine multi-type preview script
 *
 * Renders one sample post for each requested content type and writes a
 * combined gallery HTML page to /tmp/ig-preview-all/index.html
 *
 * Types covered:
 *   1. Opportunité  (opportunity-carousel · amber)
 *   2. Histoire     (news-carousel · orange)
 *   3. Bourse       (opportunity-carousel · sky-blue)
 *   4. Chiffre du jour  (quote-stat-card · purple)
 *
 * Run:
 *   cd packages/renderer
 *   npx tsx src/ig-engine/preview-all.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPost } from "./engine/buildSlides.js";
import { renderPost } from "./engine/renderSlides.js";
import type { ContentIntakeInput, SlideContent, PostCaption } from "./types/post.js";

// ── Type 1: Opportunité ───────────────────────────────────────────────────────

const opportuniteIntake: ContentIntakeInput = {
  contentTypeHint: "opportunity-carousel",
  topic: "Stage rémunéré à l'ONU pour jeunes haïtiens — Session 2026",
  sourceSummary: "L'ONU ouvre 40 places de stage rémunérés pour les étudiants haïtiens âgés de 18 à 28 ans. Les candidatures sont ouvertes jusqu'au 30 mai 2026.",
  keyFacts: ["40 places disponibles", "Rémunération : 800 $/mois", "Durée : 6 mois", "Deadline : 30 mai 2026"],
  category: "opportunity",
  date: "2026-04-08",
  preferredLanguage: "fr",
  urgencyLevel: "high",
  deadline: "30 mai 2026",
  sourceNote: "ONU Haïti · Avr 2026",
};

const opportuniteSlides: SlideContent[] = [
  {
    slideNumber: 1,
    layoutVariant: "cover",
    label: "OPPORTUNITÉ",
    headline: "Stage ONU pour jeunes haïtiens — 40 places disponibles",
    supportLine: "Rémunéré · 6 mois · Dossier avant le 30 mai",
    sourceLine: "ONU Haïti · 2026",
  },
  {
    slideNumber: 2,
    layoutVariant: "detail",
    headline: "Qui peut postuler ?",
    body: "• Âge : 18–28 ans\n• Nationalité haïtienne\n• Niveau bac +2 minimum\n• Maîtrise du français ou anglais",
    sourceLine: "ONU Haïti · 2026",
  },
  {
    slideNumber: 3,
    layoutVariant: "detail",
    headline: "Ce que vous recevez",
    body: "• Rémunération mensuelle de 800 $\n• Formation professionnelle certifiée\n• Accès au réseau ONU mondial\n• Lettre de recommandation officielle",
    sourceLine: "ONU Haïti · 2026",
  },
  {
    slideNumber: 4,
    layoutVariant: "data",
    headline: "La date limite",
    deadline: "30 mai 2026",
    body: "Dossier complet requis avant minuit (heure de Port-au-Prince)",
    sourceLine: "ONU Haïti · 2026",
  },
];

const opportuniteCaption: PostCaption = {
  text: "L'ONU ouvre 40 stages rémunérés pour les jeunes haïtiens ! 🇭🇹🌍\n\nDéadline : 30 mai 2026. Glissez pour tous les détails.",
  hashtags: ["#Haïti", "#Stage", "#ONU", "#EdLightNews", "#Opportunité"],
  cta: "Suivez @edlight.news pour ne rater aucune opportunité 🔔",
};

// ── Type 2: Histoire ──────────────────────────────────────────────────────────

const histoireIntake: ContentIntakeInput = {
  contentTypeHint: "news-carousel",
  topic: "La Révolution haïtienne et la première République noire du monde",
  sourceSummary: "Le 1er janvier 1804, Haïti devient la première République noire indépendante du monde, après 13 ans de lutte contre la puissance coloniale française.",
  keyFacts: [
    "Indépendance : 1er janvier 1804",
    "Première République noire libre",
    "13 ans de révolution",
    "Jean-Jacques Dessalines, premier chef d'État",
  ],
  category: "history",
  date: "2026-04-08",
  preferredLanguage: "fr",
  urgencyLevel: "normal",
  sourceNote: "Histoire d'Haïti",
};

const histoireSlides: SlideContent[] = [
  {
    slideNumber: 1,
    layoutVariant: "cover",
    label: "HISTOIRE",
    headline: "1804 : Haïti, première République noire libre du monde",
    supportLine: "L'histoire que chaque Haïtien doit connaître",
    sourceLine: "Histoire d'Haïti",
  },
  {
    slideNumber: 2,
    layoutVariant: "detail",
    headline: "Le contexte : une colonie sous domination",
    body: "Saint-Domingue était la colonie la plus riche de l'empire français. Des centaines de milliers d'esclaves africains travaillaient dans des conditions inhumaines pour produire sucre, café et coton.",
    sourceLine: "Histoire d'Haïti",
  },
  {
    slideNumber: 3,
    layoutVariant: "detail",
    headline: "La Révolution : 13 ans de combat",
    body: "De 1791 à 1804, les esclaves haïtiens sous la conduite de Toussaint Louverture puis Jean-Jacques Dessalines ont vaincu les armées française, espagnole et britannique.",
    sourceLine: "Histoire d'Haïti",
  },
  {
    slideNumber: 4,
    layoutVariant: "data",
    headline: "La date historique",
    statValue: "1804",
    statDescription: "Année de l'indépendance haïtienne",
    body: "La seule révolution d'esclaves couronnée de succès dans l'histoire moderne",
    sourceLine: "Histoire d'Haïti",
  },
  {
    slideNumber: 5,
    layoutVariant: "detail",
    headline: "L'héritage pour le monde entier",
    body: "L'indépendance haïtienne a inspiré les mouvements abolitionnistes à travers le monde et démontré que la liberté pouvait être conquise, pas seulement accordée.",
    sourceLine: "Histoire d'Haïti",
  },
];

const histoireCaption: PostCaption = {
  text: "En 1804, Haïti a changé l'histoire du monde 🇭🇹✊\n\nPremière République noire libre — une victoire qui appartient à toute l'humanité.",
  hashtags: ["#Haïti", "#Histoire", "#1804", "#EdLightNews", "#HaïtiForever"],
  cta: "Suivez @edlight.news pour l'histoire et la culture haïtienne 📚",
};

// ── Type 3: Bourse ────────────────────────────────────────────────────────────

const bourseIntake: ContentIntakeInput = {
  contentTypeHint: "opportunity-carousel",
  topic: "Bourse complète Université du Québec pour étudiants haïtiens 2026",
  sourceSummary: "L'Université du Québec à Montréal offre 15 bourses complètes couvrant frais de scolarité, logement et billet d'avion pour les étudiants haïtiens en master.",
  keyFacts: [
    "15 bourses complètes disponibles",
    "Couvre scolarité + logement + billet",
    "Master 1 et Master 2",
    "Deadline : 15 juin 2026",
  ],
  category: "scholarship",
  date: "2026-04-08",
  preferredLanguage: "fr",
  urgencyLevel: "high",
  deadline: "15 juin 2026",
  sourceNote: "UQAM · Avr 2026",
};

const bourseSlides: SlideContent[] = [
  {
    slideNumber: 1,
    layoutVariant: "cover",
    label: "BOURSE",
    headline: "Bourse complète UQAM pour étudiants haïtiens en master",
    supportLine: "Scolarité · Logement · Billet d'avion inclus",
    sourceLine: "UQAM · Canada",
  },
  {
    slideNumber: 2,
    layoutVariant: "detail",
    headline: "Critères d'éligibilité",
    body: "• Nationalité haïtienne\n• Admis en Master 1 ou 2 à l'UQAM\n• Dossier académique solide (mention ≥ Bien)\n• Lettre de motivation en français",
    sourceLine: "UQAM · Canada",
  },
  {
    slideNumber: 3,
    layoutVariant: "detail",
    headline: "Ce que la bourse couvre",
    body: "• Frais de scolarité intégraux\n• Logement universitaire 12 mois\n• Billet aller-retour Haïti-Montréal\n• Allocation mensuelle de 600 CAD",
    sourceLine: "UQAM · Canada",
  },
  {
    slideNumber: 4,
    layoutVariant: "data",
    headline: "Date limite de candidature",
    deadline: "15 juin 2026",
    body: "Dépôt de dossier en ligne uniquement sur le portail UQAM",
    sourceLine: "UQAM · Canada",
  },
];

const bourseCaption: PostCaption = {
  text: "15 bourses complètes pour étudier au Québec 🎓🇨🇦\n\nScolarité + logement + billet d'avion. Deadline : 15 juin 2026.",
  hashtags: ["#Haïti", "#Bourse", "#UQAM", "#EdLightNews", "#ÉtudierÀLétranger"],
  cta: "Suivez @edlight.news pour toutes les bourses 🔔",
};

// ── Type 4: Chiffre du jour (Stat card) ───────────────────────────────────────

const chiffreIntake: ContentIntakeInput = {
  contentTypeHint: "quote-stat-card",
  topic: "Taux d'alphabétisation en Haïti — chiffre du jour",
  sourceSummary: "Selon l'UNESCO, 61 % des adultes haïtiens sont alphabétisés, contre une moyenne caribéenne de 89 %. L'écart représente l'un des défis majeurs du système éducatif.",
  keyFacts: ["61 % d'adultes alphabétisés", "Moyenne caribéenne : 89 %", "Source : UNESCO 2025"],
  category: "stat",
  date: "2026-04-08",
  preferredLanguage: "fr",
  urgencyLevel: "normal",
  sourceNote: "UNESCO · 2025",
};

const chiffreSlides: SlideContent[] = [
  {
    slideNumber: 1,
    layoutVariant: "data",
    label: "DONNÉES",
    headline: "Taux d'alphabétisation adulte en Haïti",
    statValue: "61 %",
    statDescription: "des adultes haïtiens savent lire et écrire",
    body: "La moyenne caribéenne est de 89 % — Source : UNESCO 2025",
    sourceLine: "UNESCO · 2025",
  },
];

const chiffreCaption: PostCaption = {
  text: "61 % des adultes haïtiens sont alphabétisés 📊\n\nLa moyenne caribéenne est de 89 %. L'éducation reste le défi numéro 1.",
  hashtags: ["#Haïti", "#Éducation", "#Données", "#EdLightNews", "#UNESCO"],
  cta: "Suivez @edlight.news pour les données qui comptent 📊",
};

// ── Render all types and build gallery ────────────────────────────────────────

interface PostSample {
  label: string;
  accent: string;
  intake: ContentIntakeInput;
  slides: SlideContent[];
  caption: PostCaption;
  contentType: string;
}

const SAMPLES: PostSample[] = [
  { label: "Opportunité",      accent: "#fbbf24", intake: opportuniteIntake, slides: opportuniteSlides, caption: opportuniteCaption, contentType: "opportunity" },
  { label: "Histoire",         accent: "#f59e0b", intake: histoireIntake,    slides: histoireSlides,    caption: histoireCaption,    contentType: "history" },
  { label: "Bourse",           accent: "#60a5fa", intake: bourseIntake,      slides: bourseSlides,      caption: bourseCaption,      contentType: "scholarship" },
  { label: "Chiffre du jour",  accent: "#a855f7", intake: chiffreIntake,     slides: chiffreSlides,     caption: chiffreCaption,     contentType: "stat" },
];

async function main() {
  const OUT = "/tmp/ig-preview-all";
  mkdirSync(OUT, { recursive: true });

  // ── Render each sample ────────────────────────────────────────────────────

  interface RenderedSection {
    label: string;
    accent: string;
    status: string;
    templateId: string;
    slideCount: number;
    uris: string[];
  }

  const sections: RenderedSection[] = [];

  for (const sample of SAMPLES) {
    console.log(`\n▶  ${sample.label} …`);
    const { post } = buildPost({ intake: sample.intake, rawSlides: sample.slides, caption: sample.caption });
    const rendered = await renderPost(post, sample.contentType);

    const uris: string[] = [];
    for (const r of rendered) {
      const path = join(OUT, `${sample.contentType}-slide-${r.slideNumber}.png`);
      writeFileSync(path, r.png);
      uris.push(`data:image/png;base64,${r.png.toString("base64")}`);
      console.log(`   ✓ slide ${r.slideNumber} → ${path}`);
    }

    sections.push({
      label: sample.label,
      accent: sample.accent,
      status: post.status,
      templateId: post.templateId,
      slideCount: post.slides.length,
      uris,
    });
  }

  // ── Build combined gallery ────────────────────────────────────────────────

  const sectionsHtml = sections.map(sec => {
    const thumbs = sec.uris.map((uri, i) => `
      <div class="thumb-col">
        <p class="num">Slide ${i + 1}</p>
        <img src="${uri}" width="216" height="270" style="border-radius:6px;display:block" />
      </div>`).join("");

    const fullSlides = sec.uris.map((uri, i) => `
      <div style="flex-shrink:0">
        <p style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Slide ${i + 1}</p>
        <img src="${uri}" width="486" height="607" style="border-radius:8px;display:block" />
      </div>`).join("");

    const statusColor = sec.status === "validated" ? "#34d399" : "#f59e0b";
    const statusBg    = sec.status === "validated" ? "#052e16" : "#1c1208";

    return `
    <section style="margin-bottom:72px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div style="width:14px;height:14px;border-radius:50%;background:${sec.accent};flex-shrink:0"></div>
        <h2 style="font-size:22px;font-weight:700;letter-spacing:0.5px">${sec.label}</h2>
        <span style="font-size:12px;color:#475569;font-family:monospace">${sec.templateId}</span>
        <span style="margin-left:auto;padding:3px 12px;border-radius:4px;font-size:12px;font-weight:700;
          background:${statusBg};color:${statusColor};border:1px solid ${statusColor}44">
          ${sec.status === "validated" ? "✓ validated" : "⚠ draft"}
        </span>
      </div>

      <!-- thumbnail strip -->
      <div style="display:flex;gap:12px;margin-bottom:28px;overflow-x:auto;padding-bottom:8px">
        ${thumbs}
      </div>

      <!-- full-size row -->
      <div style="display:flex;gap:20px;overflow-x:auto;padding-bottom:8px">
        ${fullSlides}
      </div>
    </section>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>EdLight News — All Template Previews</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:system-ui,sans-serif; background:#07111f; color:#e2e8f0; padding:48px 40px; }
  h1 { font-size:24px; font-weight:700; letter-spacing:1px; margin-bottom:6px; }
  .meta { font-size:13px; color:#475569; margin-bottom:44px; }
  .thumb-col { flex-shrink:0; text-align:center; }
  .num { font-size:10px; text-transform:uppercase; letter-spacing:2px; color:#475569; margin-bottom:6px; }
</style>
</head>
<body>
  <h1>EdLight News — Template Gallery</h1>
  <p class="meta">Opportunité · Histoire · Bourse · Chiffre du jour — Generated ${new Date().toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}</p>
  ${sectionsHtml}
</body>
</html>`;

  const previewPath = join(OUT, "index.html");
  writeFileSync(previewPath, html, "utf8");

  console.log(`\n✅  Gallery → ${previewPath}`);
  console.log(`   ${sections.length} post types rendered`);
}

main().catch(err => { console.error(err); process.exit(1); });
