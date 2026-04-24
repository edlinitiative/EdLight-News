/**
 * CTA-slide preview — shows the new vivid closing slide for all 4 templates.
 *
 * Run:
 *   cd packages/renderer
 *   npx tsx src/ig-engine/preview-cta.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPost } from "./engine/buildSlides.js";
import { renderPost } from "./engine/renderSlides.js";
import type { ContentIntakeInput, SlideContent, PostCaption } from "./types/post.js";

const OUT = "/tmp/ig-cta-preview";
mkdirSync(OUT, { recursive: true });

// ── Per-type image URLs (Unsplash free-to-use) ─────────────────────────────
// News: students in a classroom
const IMG_NEWS        = "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1080&q=80";
// Opportunity: young professional / UN building
const IMG_OPPORTUNITY = "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1080&q=80";
// Explainer: open books / studying
const IMG_EXPLAINER   = "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1080&q=80";
// Weekly Recap: newspaper / morning overview
const IMG_WEEKLY      = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1080&q=80";

// ── One sample per template ──────────────────────────────────────────────────

interface Sample {
  label: string;
  contentType: string;
  intake: ContentIntakeInput;
  rawSlides: SlideContent[];
  caption: PostCaption;
}

const SAMPLES: Sample[] = [
  // 1 — News Carousel
  {
    label: "News Carousel",
    contentType: "news",
    intake: {
      contentTypeHint: "news-carousel",
      topic: "Plan quinquennal pour l'éducation haïtienne",
      sourceSummary: "Le gouvernement haïtien annonce un plan éducatif ambitieux.",
      keyFacts: ["500 000 enfants visés", "Budget 2,3 Mds HTG"],
      category: "news",
      date: "2026-04-09",
      preferredLanguage: "fr",
      urgencyLevel: "high",
      sourceNote: "MEN Haïti · 2026",
    },
    rawSlides: [
      {
        slideNumber: 1,
        layoutVariant: "cover",
        label: "ACTUALITÉ",
        headline: "500 000 enfants de plus à l'école d'ici 2030",
        supportLine: "Le gouvernement présente un plan historique",
        sourceLine: "MEN Haïti · 2026",
      },
      {
        slideNumber: 2,
        layoutVariant: "cta",
        headline: "Suivez EdLight News",
        body: "L'actualité haïtienne, chaque jour.",
        imageUrl: IMG_NEWS,
      },
    ],
    caption: {
      text: "Un plan éducatif historique pour Haïti.",
      hashtags: ["#Haïti", "#Éducation", "#EdLightNews"],
      cta: "Suivez @edlightnews 🔔",
    },
  },

  // 2 — Opportunity Carousel
  {
    label: "Opportunity Carousel",
    contentType: "opportunity",
    intake: {
      contentTypeHint: "opportunity-carousel",
      topic: "Stage ONU pour jeunes haïtiens 2026",
      sourceSummary: "L'ONU ouvre 40 stages rémunérés pour les étudiants haïtiens.",
      keyFacts: ["40 places", "800 $/mois", "Deadline 30 mai"],
      category: "opportunity",
      date: "2026-04-09",
      preferredLanguage: "fr",
      urgencyLevel: "high",
      deadline: "30 mai 2026",
      sourceNote: "ONU Haïti · 2026",
    },
    rawSlides: [
      {
        slideNumber: 1,
        layoutVariant: "cover",
        label: "OPPORTUNITÉ",
        headline: "Stage ONU — 40 places pour jeunes haïtiens",
        supportLine: "Rémunéré · 6 mois · Dossier avant le 30 mai",
        sourceLine: "ONU Haïti · 2026",
      },
      {
        slideNumber: 2,
        layoutVariant: "cta",
        headline: "Ne ratez aucune opportunité",
        body: "Bourses, stages et concours pour étudiants haïtiens.",
        imageUrl: IMG_OPPORTUNITY,
      },
    ],
    caption: {
      text: "L'ONU ouvre 40 stages rémunérés pour les jeunes haïtiens !",
      hashtags: ["#Haïti", "#Stage", "#ONU", "#EdLightNews"],
      cta: "Suivez @edlightnews 🔔",
    },
  },

  // 3 — Explainer Carousel
  {
    label: "Explainer Carousel",
    contentType: "explainer",
    intake: {
      contentTypeHint: "explainer-carousel",
      topic: "Comment fonctionne le système éducatif haïtien ?",
      sourceSummary: "Explication du système éducatif haïtien en 4 points clés.",
      keyFacts: ["Primaire 6 ans", "Secondaire 7 ans", "Bac requis pour université"],
      category: "explainer",
      date: "2026-04-09",
      preferredLanguage: "fr",
      urgencyLevel: "normal",
      sourceNote: "MEN Haïti · 2026",
    },
    rawSlides: [
      {
        slideNumber: 1,
        layoutVariant: "cover",
        label: "EXPLAINER",
        headline: "Le système éducatif haïtien en 4 points",
        supportLine: "Ce que vous devez savoir",
        sourceLine: "MEN Haïti · 2026",
      },
      {
        slideNumber: 2,
        layoutVariant: "cta",
        headline: "Éducation, économie, politique",
        body: "Tout ce que vous devez comprendre — simplement expliqué.",
        imageUrl: IMG_EXPLAINER,
      },
    ],
    caption: {
      text: "Le système éducatif haïtien expliqué simplement.",
      hashtags: ["#Haïti", "#Éducation", "#EdLightNews"],
      cta: "Suivez @edlightnews 🔔",
    },
  },

  // 4 — Weekly Recap
  {
    label: "Weekly Recap",
    contentType: "weekly-recap",
    intake: {
      contentTypeHint: "weekly-recap-carousel",
      topic: "Récap de la semaine du 7 au 13 avril 2026",
      sourceSummary: "Les 5 faits marquants de la semaine en Haïti.",
      keyFacts: ["Plan éducatif annoncé", "Bourses ONU ouvertes", "Données UNESCO publiées"],
      category: "recap",
      date: "2026-04-13",
      preferredLanguage: "fr",
      urgencyLevel: "normal",
      sourceNote: "EdLight News · Avr 2026",
    },
    rawSlides: [
      {
        slideNumber: 1,
        layoutVariant: "cover",
        label: "RÉCAP",
        headline: "La semaine en Haïti — 7 au 13 avril",
        supportLine: "5 faits marquants à retenir",
        sourceLine: "EdLight News · 2026",
      },
      {
        slideNumber: 2,
        layoutVariant: "cta",
        headline: "Chaque semaine, l'essentiel",
        body: "Les informations les plus importantes pour les étudiants haïtiens.",
        imageUrl: IMG_WEEKLY,
      },
    ],
    caption: {
      text: "Votre récap de la semaine est arrivé 📋",
      hashtags: ["#Haïti", "#Récap", "#EdLightNews"],
      cta: "Suivez @edlightnews 🔔",
    },
  },
];

// ── Render ───────────────────────────────────────────────────────────────────

async function main() {
  interface Section {
    label: string;
    uris: string[];
    slideLabels: string[];
  }

  const sections: Section[] = [];

  for (const s of SAMPLES) {
    console.log(`▶  Rendering ${s.label} …`);
    const { post } = buildPost({ intake: s.intake, rawSlides: s.rawSlides, caption: s.caption });
    const rendered = await renderPost(post, s.contentType);

    const uris: string[] = [];
    const slideLabels: string[] = ["Cover", "CTA (new)"];

    for (const r of rendered) {
      const path = join(OUT, `${s.contentType}-slide-${r.slideNumber}.png`);
      writeFileSync(path, r.png);
      uris.push(`data:image/png;base64,${r.png.toString("base64")}`);
      console.log(`   ✓ slide ${r.slideNumber} → ${path}`);
    }

    sections.push({ label: s.label, uris, slideLabels });
  }

  // ── HTML ────────────────────────────────────────────────────────────────────

  const sectionsHtml = sections
    .map((sec) => {
      const cols = sec.uris
        .map(
          (uri, i) => `
      <div style="flex-shrink:0;text-align:center">
        <p style="font-size:11px;font-family:monospace;letter-spacing:2px;text-transform:uppercase;
                  color:${i === 1 ? "#34d399" : "#64748b"};margin-bottom:8px">
          ${sec.slideLabels[i] ?? `Slide ${i + 1}`}
        </p>
        <img src="${uri}" width="486" height="607" style="border-radius:10px;display:block;
          ${i === 1 ? "box-shadow:0 0 0 2px #34d39944, 0 16px 48px rgba(0,0,0,0.6)" : ""}" />
      </div>`,
        )
        .join("");

      return `
    <section style="margin-bottom:72px">
      <h2 style="font-size:20px;font-weight:700;margin-bottom:20px;padding-bottom:12px;
                 border-bottom:1px solid #1e293b">${sec.label}</h2>
      <div style="display:flex;gap:24px;overflow-x:auto;padding-bottom:8px">${cols}</div>
    </section>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>EdLight News — CTA Slide Preview</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:system-ui,sans-serif; background:#07111f; color:#e2e8f0; padding:48px 40px; }
  h1 { font-size:26px; font-weight:800; letter-spacing:1px; margin-bottom:6px; }
  .sub { font-size:13px; color:#475569; margin-bottom:48px; }
  .badge { display:inline-flex;align-items:center;gap:8px;background:#052e16;color:#34d399;
           border:1px solid #34d39944;border-radius:6px;padding:6px 16px;font-size:13px;
           font-weight:700;margin-bottom:48px; }
</style>
</head>
<body>
  <h1>EdLight News — CTA Slide Preview</h1>
  <p class="sub">New vivid closing slide · 4 templates · Photo bg + 80px display headline + accent pill</p>
  <div class="badge">✦ CTA slides highlighted in green</div>
  ${sectionsHtml}
</body>
</html>`;

  const previewPath = join(OUT, "index.html");
  writeFileSync(previewPath, html, "utf8");

  console.log(`\n✅  Preview → ${previewPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
