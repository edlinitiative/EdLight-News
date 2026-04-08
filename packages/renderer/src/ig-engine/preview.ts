/**
 * IG Engine preview script
 *
 * Renders a sample 5-slide "News Carousel" post and writes each slide
 * as a PNG + a single HTML preview page to /tmp/ig-preview/.
 *
 * Run:
 *   cd packages/renderer
 *   node --import tsx src/ig-engine/preview.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPost } from "./engine/buildSlides.js";
import { renderPost } from "./engine/renderSlides.js";
import { exportPost } from "./engine/exportSlides.js";
import { buildFitReport, formatFitReport } from "./qa/fitReport.js";
import type { ContentIntakeInput, SlideContent, PostCaption } from "./types/post.js";

// ── Sample content (Haiti education news, French) ─────────────────────────────

const intake: ContentIntakeInput = {
  contentTypeHint: "news-carousel",
  topic: "Le gouvernement haïtien annonce un plan pour l'éducation publique",
  sourceSummary:
    "Le Ministère de l'Éducation Nationale a présenté un plan quinquennal visant à scolariser " +
    "500 000 enfants supplémentaires d'ici 2030, avec un budget de 2,3 milliards de gourdes " +
    "financé en partie par la Banque mondiale.",
  keyFacts: [
    "500 000 enfants supplémentaires visés",
    "Budget : 2,3 milliards de gourdes",
    "Partenariat avec la Banque mondiale",
    "Objectif : 2030",
  ],
  category: "news",
  date: "2026-04-08",
  preferredLanguage: "fr",
  urgencyLevel: "high",
  sourceNote: "Ministère Éducation Haïti · Avr 2026",
};

const rawSlides: SlideContent[] = [
  // Slide 1 — cover
  {
    slideNumber: 1,
    layoutVariant: "cover",
    label: "ACTUALITÉ",
    headline: "500 000 enfants de plus à l'école d'ici 2030",
    supportLine: "Le gouvernement présente un plan historique pour l'éducation publique",
    sourceLine: "Ministère Éducation · Haïti",
  },
  // Slide 2 — what happened
  {
    slideNumber: 2,
    layoutVariant: "detail",
    headline: "Un plan quinquennal ambitieux",
    body: "Le Ministère de l'Éducation Nationale a présenté un plan sur cinq ans pour scolariser 500 000 enfants supplémentaires. Un budget de 2,3 milliards de gourdes a été alloué pour financer les infrastructures et les enseignants.",
    sourceLine: "Ministère Éducation · Haïti",
  },
  // Slide 3 — why it matters
  {
    slideNumber: 3,
    layoutVariant: "detail",
    headline: "Pourquoi c'est important",
    body: "Haïti affiche l'un des taux de scolarisation les plus bas de la région. Ce plan représente la plus grande initiative éducative de la décennie et pourrait transformer le futur du pays.",
    sourceLine: "Ministère Éducation · Haïti",
  },
  // Slide 4 — key number
  {
    slideNumber: 4,
    layoutVariant: "data",
    headline: "Le chiffre clé",
    statValue: "2,3 Mds",
    statDescription: "de gourdes investis dans l'éducation publique",
    body: "Financement partiellement garanti par la Banque mondiale",
    sourceLine: "Banque mondiale · 2026",
  },
  // Slide 5 — what comes next
  {
    slideNumber: 5,
    layoutVariant: "detail",
    headline: "Prochaines étapes",
    body: "Les travaux de construction de 200 nouvelles écoles débuteront en septembre 2026. Les recrutements d'enseignants sont prévus pour janvier 2027.",
    sourceLine: "Ministère Éducation · Haïti",
  },
];

const caption: PostCaption = {
  text:
    "Le gouvernement haïtien vient d'annoncer un plan historique pour scolariser 500 000 enfants supplémentaires d'ici 2030 🇭🇹📚\n\n" +
    "Un investissement de 2,3 milliards de gourdes, soutenu par la Banque mondiale. " +
    "Glissez pour comprendre les détails.",
  hashtags: [
    "#Haïti", "#Éducation", "#EdLightNews", "#HaïtiForward",
    "#ÉducationPourTous", "#DéveloppementHaïti",
  ],
  cta: "Suivez @edlight.news pour l'actualité éducative en Haïti 🔔",
};

// ── Run the pipeline ─────────────────────────────────────────────────────────

async function main() {
const OUT = "/tmp/ig-preview";
mkdirSync(OUT, { recursive: true });

console.log("▶  Building post …");
const { post, overflowWarnings } = buildPost({ intake, rawSlides, caption });

if (overflowWarnings.length > 0) {
  console.warn("⚠  Overflow warnings:");
  for (const w of overflowWarnings) console.warn("   ", w);
}

// Print fit report
const report = buildFitReport(post);
console.log(formatFitReport(report));

console.log("▶  Rendering slides …");
const rendered = await renderPost(post, "news");

// Write individual PNGs + gather base64 data-URIs for the preview page
const slideDataUris: string[] = [];
for (const r of rendered) {
  const path = join(OUT, `slide-${r.slideNumber}.png`);
  writeFileSync(path, r.png);
  slideDataUris.push(`data:image/png;base64,${r.png.toString("base64")}`);
  console.log(`   ✓ slide ${r.slideNumber} → ${path}`);
}

// ── Build a self-contained HTML preview page ─────────────────────────────────

const thumbs = slideDataUris
  .map(
    (uri, i) => `
    <div class="col">
      <p class="num">Slide ${i + 1}</p>
      <img src="${uri}" width="270" height="338" />
    </div>`,
  )
  .join("");

const slidesFull = slideDataUris
  .map(
    (uri, i) => `
    <section id="slide-${i + 1}">
      <h2>Slide ${i + 1}</h2>
      <img src="${uri}" width="540" height="675" style="border-radius:8px" />
    </section>`,
  )
  .join("");

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>EdLight News — IG Preview</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:system-ui,sans-serif; background:#07111f; color:#e2e8f0; padding:40px; }
  h1 { font-size:22px; font-weight:700; letter-spacing:1px; margin-bottom:6px; }
  .meta { font-size:13px; color:#64748b; margin-bottom:32px; }
  .strip { display:flex; gap:16px; overflow-x:auto; padding-bottom:16px; margin-bottom:48px; }
  .col { flex-shrink:0; text-align:center; }
  .num { font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#64748b; margin-bottom:8px; }
  section { margin-bottom:56px; }
  section h2 { font-size:15px; font-weight:600; color:#94a3b8; margin-bottom:14px; }
  .status { display:inline-block; padding:4px 14px; border-radius:4px; font-size:13px; font-weight:700; margin-bottom:28px;
    background:${post.status === "validated" ? "#052e16" : "#450a0a"};
    color:${post.status === "validated" ? "#34d399" : "#f43f5e"};
    border:1px solid ${post.status === "validated" ? "#34d39944" : "#f43f5e44"};
  }
</style>
</head>
<body>
  <h1>EdLight News — IG Engine Preview</h1>
  <p class="meta">${post.templateId} · ${post.language.toUpperCase()} · ${post.slides.length} slides · ${post.topic}</p>
  <p class="status">${post.status === "validated" ? "✓  VALIDATED — ready to export" : "✗  DRAFT — overflow issues"}</p>

  <h2 style="font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">All slides</h2>
  <div class="strip">${thumbs}</div>

  ${slidesFull}

  <p style="font-size:12px;color:#334155;margin-top:40px;padding-top:16px;border-top:1px solid #1e293b">
    Post ID: ${post.id} · Generated: ${new Date().toISOString()}
  </p>
</body>
</html>`;

const previewPath = join(OUT, "index.html");
writeFileSync(previewPath, html, "utf8");

console.log(`\n✅  Preview → ${previewPath}`);
console.log(`   Status : ${post.status}`);
console.log(`   Slides : ${post.slides.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
