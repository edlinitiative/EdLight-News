/**
 * previewHistoire.ts — Generate an HTML gallery of histoire carousel slides
 * for visual inspection. No Playwright needed — just HTML in a browser.
 *
 * Usage:
 *   cd apps/worker && npx tsx src/scripts/previewHistoire.ts
 *   Then open /tmp/ig-histoire-preview/index.html
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildSlideHtml, adaptLegacyPayload } from "@edlight-news/renderer/ig-engine.js";
import type { IGSlide, IGPostType, IGQueueItem, IGFormattedPayload } from "@edlight-news/types";

const OUT = "/tmp/ig-histoire-preview";

/* ── Sample histoire carousel data ───────────────────────────────────────── */

const histoireSlides: IGSlide[] = [
  // Slide 1 — Cover
  {
    heading: "La Citadelle Laferrière — 1820",
    bullets: [
      "La plus grande forteresse des Amériques, symbole de la résistance haïtienne",
    ],
    footer: "Source: UNESCO · archives nationales",
    layout: "headline",
    backgroundImage:
      "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=1200",
  },
  // Slide 2 — Narrative (detail)
  {
    heading: "Pourquoi c'est important",
    bullets: [
      "Construite entre 1805 et 1820 sous le règne du roi Henri Christophe, la Citadelle devait protéger la jeune nation contre un éventuel retour des forces coloniales françaises.",
      "Classée au patrimoine mondial de l'UNESCO en 1982, elle reste le monument le plus visité d'Haïti et un symbole puissant de la première république noire indépendante.",
    ],
    footer: "Source: UNESCO · archives nationales",
    layout: "explanation",
  },
  // Slide 3 — Other facts ("Aussi le 10 avril") — 2 bullets after our fix
  {
    heading: "Aussi le 10 avril",
    bullets: [
      "En 1864, l'empereur Maximilien d'Autriche accepte la couronne du Mexique, un événement qui bouleversa l'équilibre politique des Amériques.",
      "En 1970, Paul McCartney annonce officiellement la séparation des Beatles, marquant la fin d'une ère musicale et culturelle mondiale.",
    ],
    footer: "Source: archives nationales",
    layout: "explanation",
  },
  // Slide 4 — CTA
  {
    heading: "Suivez EdLight News",
    bullets: ["L'histoire haïtienne, chaque jour."],
    footer: "",
    layout: "cta",
    backgroundImage:
      "https://firebasestorage.googleapis.com/v0/b/edlight-news.firebasestorage.app/o/ig_assets%2Fcta%2Fhistoire-cta.jpg?alt=media&token=c6b8f5c4-9933-41d9-89f6-cd40362b0c0a",
  },
];

/* ── Variant: 3-bullet "Aussi le X" slide (pre-fix behaviour) ────────── */

const histoireSlides3Bullets: IGSlide[] = [
  histoireSlides[0]!,
  histoireSlides[1]!,
  {
    heading: "Aussi le 10 avril",
    bullets: [
      "En 1864, l'empereur Maximilien d'Autriche accepte la couronne du Mexique, un événement qui bouleversa l'équilibre politique des Amériques.",
      "En 1970, Paul McCartney annonce officiellement la séparation des Beatles, marquant la fin d'une ère musicale et culturelle mondiale.",
      "En 1912, le Titanic quitte Southampton pour sa traversée inaugurale qui se terminera tragiquement quatre jours plus tard dans l'Atlantique Nord.",
    ],
    footer: "Source: archives nationales",
    layout: "explanation",
  },
  histoireSlides[3]!,
];

/* ── Build HTML for each carousel ─────────────────────────────────────── */

function buildCarouselHtmls(
  slides: IGSlide[],
  label: string,
): { name: string; html: string }[] {
  const queueItem = {
    id: "preview",
    sourceContentId: "",
    igType: "histoire" as IGPostType,
    score: 100,
    status: "queued",
    reasons: [],
  } as unknown as IGQueueItem;

  const payload: IGFormattedPayload = { slides, caption: "" };
  const { intake, rawSlides, contentType } = adaptLegacyPayload(queueItem, payload);
  const templateId = intake.contentTypeHint!;

  return rawSlides.map((slide, i) => ({
    name: `${label}_slide_${i + 1}`,
    html: buildSlideHtml(templateId, slide, contentType, i, rawSlides.length),
  }));
}

const carousels = [
  { label: "histoire_2bullets", slides: histoireSlides, title: "Histoire — 2 bullets (after fix)" },
  { label: "histoire_3bullets", slides: histoireSlides3Bullets, title: "Histoire — 3 bullets (pre-fix stress test)" },
];

/* ── Assemble gallery HTML ────────────────────────────────────────────── */

mkdirSync(OUT, { recursive: true });

let galleryHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Histoire IG Preview</title>
<style>
  body { font-family: system-ui; background: #111; color: #eee; padding: 32px; }
  h1 { text-align: center; margin-bottom: 40px; }
  h2 { margin: 48px 0 16px; border-bottom: 1px solid #444; padding-bottom: 8px; }
  .carousel { display: flex; gap: 24px; overflow-x: auto; padding: 16px 0; }
  .slide-wrap { flex-shrink: 0; }
  .slide-label { text-align: center; font-size: 13px; opacity: 0.6; margin-bottom: 6px; }
  iframe {
    width: 1080px; height: 1350px;
    transform: scale(0.3); transform-origin: top left;
    border: 2px solid #333; border-radius: 8px;
  }
  .slide-wrap { width: 324px; height: 405px; }
</style>
</head><body>
<h1>📜 Histoire Carousel Preview</h1>
`;

for (const c of carousels) {
  const slides = buildCarouselHtmls(c.slides, c.label);
  galleryHtml += `<h2>${c.title} (${slides.length} slides)</h2>\n<div class="carousel">\n`;

  for (const s of slides) {
    // Write each slide as a standalone HTML file
    const filename = `${s.name}.html`;
    writeFileSync(join(OUT, filename), s.html);

    // Embed as iframe in gallery
    galleryHtml += `<div class="slide-wrap">
  <div class="slide-label">${s.name}</div>
  <iframe src="${filename}" sandbox="allow-same-origin" loading="lazy"></iframe>
</div>\n`;
  }

  galleryHtml += `</div>\n`;
}

galleryHtml += `</body></html>`;
writeFileSync(join(OUT, "index.html"), galleryHtml);

console.log(`\n✅ Preview gallery written to ${OUT}/index.html`);
console.log(`   ${carousels.reduce((n, c) => n + c.slides.length, 0)} slides total\n`);
