/**
 * IG Pipeline Dry-Run Script
 *
 * Exercises the full Instagram pipeline locally with mock data:
 *   selection → formatting → carousel rendering (HTML) → dry-run publish
 *
 * No Firebase credentials needed — everything runs locally and writes to /tmp.
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker ig:dry-run
 *   pnpm --filter @edlight-news/worker ig:dry-run -- --type scholarship
 *   pnpm --filter @edlight-news/worker ig:dry-run -- --type histoire
 */

import type {
  Item,
  IGPostType,
  IGFormattedPayload,
  IGQueueItem,
} from "@edlight-news/types";
import { decideIG, formatForIG } from "@edlight-news/generator/ig/index.js";
import { buildSlideHTML } from "@edlight-news/renderer/ig-carousel.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── CLI args ──────────────────────────────────────────────────────────────

function parseArgs(): { type: IGPostType | "all" } {
  const args = process.argv.slice(2);
  let type: IGPostType | "all" = "all";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && args[i + 1]) {
      type = args[++i] as IGPostType;
    }
  }
  return { type };
}

// ── Mock data ─────────────────────────────────────────────────────────────

const NOW_TS = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any;

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0]!;
}

const MOCK_ITEMS: Record<IGPostType, Item> = {
  scholarship: {
    id: "mock-scholarship-1",
    rawItemId: "raw-mock-1",
    sourceId: "src-mock-1",
    title: "Bourse Complète pour Étudiants Haïtiens – Université de Montréal 2026",
    summary:
      "L'Université de Montréal offre une bourse complète couvrant frais de scolarité, " +
      "logement et allocation mensuelle pour les étudiants haïtiens de niveau licence. " +
      "Les candidatures sont ouvertes jusqu'au 15 avril 2026.",
    canonicalUrl: "https://example.edu/bourses/montreal-2026",
    imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1080&q=80",
    category: "scholarship",
    deadline: futureDate(10),
    evergreen: false,
    confidence: 0.92,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    },
    citations: [
      { sourceName: "Université de Montréal", sourceUrl: "https://example.edu/bourses/montreal-2026" },
    ],
    audienceFitScore: 0.85,
    source: {
      name: "Université de Montréal",
      originalUrl: "https://example.edu/bourses/montreal-2026",
    },
    opportunity: {
      deadline: futureDate(10),
      eligibility: [
        "Nationalité haïtienne",
        "Niveau licence (terminale ou diplôme équivalent)",
        "Moyenne générale ≥ 13/20",
        "Maîtrise du français (TCF B2 minimum)",
      ],
      coverage: "Frais de scolarité + logement + 800 CAD/mois",
      howToApply: "Soumettre dossier en ligne avant le 15 avril 2026",
      officialLink: "https://example.edu/apply",
    },
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
  } as Item,

  opportunity: {
    id: "mock-opportunity-1",
    rawItemId: "raw-mock-2",
    sourceId: "src-mock-2",
    title: "Stage d'été en Intelligence Artificielle – Google DeepMind",
    summary:
      "Google DeepMind recrute des stagiaires pour l'été 2026. Programme de 12 semaines " +
      "à Londres, ouvert aux étudiants en informatique de toute nationalité.",
    canonicalUrl: "https://deepmind.google/careers/internship-2026",
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1080&q=80",
    category: "opportunity",
    deadline: futureDate(21),
    evergreen: false,
    confidence: 0.88,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    },
    citations: [
      { sourceName: "Google DeepMind", sourceUrl: "https://deepmind.google/careers/internship-2026" },
    ],
    audienceFitScore: 0.7,
    source: {
      name: "Google DeepMind",
      originalUrl: "https://deepmind.google/careers/internship-2026",
    },
    opportunity: {
      deadline: futureDate(21),
      eligibility: [
        "Étudiant(e) en Master ou PhD en informatique/ML",
        "Toutes nationalités acceptées",
        "Anglais courant",
      ],
      coverage: "Rémunération compétitive + hébergement Londres",
      howToApply: "Postuler via le portail careers de Google",
      officialLink: "https://deepmind.google/careers/internship-2026",
    },
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
  } as Item,

  news: {
    id: "mock-news-1",
    rawItemId: "raw-mock-3",
    sourceId: "src-mock-3",
    title: "Le MENFP annonce les dates du baccalauréat 2026",
    summary:
      "Le Ministère de l'Éducation Nationale a publié le calendrier officiel des examens du baccalauréat " +
      "pour l'année scolaire 2025-2026. Les épreuves se tiendront du 15 au 25 juin 2026.",
    extractedText:
      "Le calendrier prévoit des sessions de rattrapage en septembre. " +
      "Les inscriptions pour les candidats libres ferment le 31 mars. " +
      "Les centres d'examen seront répartis dans les 10 départements. " +
      "Un formulaire d'inscription en ligne sera disponible sur le site du MENFP.",
    canonicalUrl: "https://menfp.gouv.ht/communiques/bac-2026",
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1080&q=80",
    category: "news",
    geoTag: "HT",
    deadline: null,
    evergreen: false,
    confidence: 0.95,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    },
    citations: [
      { sourceName: "MENFP", sourceUrl: "https://menfp.gouv.ht/communiques/bac-2026" },
    ],
    audienceFitScore: 0.9,
    source: {
      name: "MENFP",
      originalUrl: "https://menfp.gouv.ht/communiques/bac-2026",
    },
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
  } as Item,

  histoire: {
    id: "mock-histoire-1",
    rawItemId: "raw-mock-4",
    sourceId: "src-mock-4",
    title: "1er janvier 1804 – Haïti proclame son indépendance",
    summary:
      "Le 1er janvier 1804, Jean-Jacques Dessalines proclame l'indépendance d'Haïti à Gonaïves, " +
      "faisant de la nation la première république noire libre au monde et le deuxième pays " +
      "indépendant des Amériques.",
    extractedText:
      "La cérémonie a eu lieu à la place d'Armes de Gonaïves. " +
      "Dessalines choisit le nom taïno 'Ayiti' pour la nouvelle nation. " +
      "L'acte d'indépendance fut rédigé par Boisrond-Tonnerre. " +
      "Ce fut l'aboutissement de 13 ans de lutte révolutionnaire.",
    canonicalUrl: "https://edlightnews.com/histoire/independance-haiti",
    imageUrl: "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=1080&q=80",
    category: "resource",
    itemType: "utility",
    deadline: null,
    evergreen: true,
    confidence: 0.98,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    },
    citations: [
      { sourceName: "EdLight News", sourceUrl: "https://edlightnews.com/histoire/independance-haiti" },
    ],
    audienceFitScore: 0.75,
    source: {
      name: "EdLight News",
      originalUrl: "https://edlightnews.com/histoire/independance-haiti",
    },
    utilityMeta: {
      series: "HaitiHistory",
      utilityType: "history",
      citations: [
        { label: "Laurent Dubois – Avengers of the New World", url: "https://example.com/book" },
        { label: "Archives nationales d'Haïti", url: "https://example.com/archives" },
      ],
    },
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
  } as Item,

  utility: {
    id: "mock-utility-1",
    rawItemId: "raw-mock-5",
    sourceId: "src-mock-5",
    title: "Guide pratique – Préparer son dossier Campus France depuis Haïti",
    summary:
      "Toutes les étapes pour constituer un dossier solide sur la plateforme Études en France " +
      "et obtenir un visa étudiant pour la France depuis Haïti.",
    canonicalUrl: "https://edlightnews.com/ressources/campus-france-guide",
    imageUrl: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1080&q=80",
    category: "resource",
    itemType: "utility",
    deadline: null,
    evergreen: true,
    confidence: 0.9,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    },
    citations: [
      { sourceName: "Campus France", sourceUrl: "https://www.campusfrance.org/fr" },
    ],
    audienceFitScore: 0.8,
    source: {
      name: "EdLight News",
      originalUrl: "https://edlightnews.com/ressources/campus-france-guide",
    },
    utilityMeta: {
      series: "StudyAbroad",
      utilityType: "study_abroad",
      extractedFacts: {
        deadlines: [
          { label: "Inscription Études en France", dateISO: futureDate(45), sourceUrl: "https://www.campusfrance.org/fr" },
          { label: "Entretien Campus France", dateISO: futureDate(60), sourceUrl: "https://www.campusfrance.org/fr" },
        ],
        requirements: [
          "Relevés de notes certifiés",
          "TCF/DELF B2 minimum",
          "Lettre de motivation en français",
        ],
        steps: [
          "Créer un compte sur Études en France",
          "Remplir le formulaire et téléverser les documents",
          "Payer les frais de dossier (70 €)",
          "Passer l'entretien pédagogique",
        ],
        notes: [
          "Commencez votre dossier au moins 3 mois avant la date limite",
          "Les résultats TCF sont valables 2 ans",
        ],
      },
      citations: [
        { label: "Campus France Haïti", url: "https://www.haiti.campusfrance.org" },
      ],
    },
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
  } as Item,
};

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { type } = parseArgs();
  const types: IGPostType[] =
    type === "all"
      ? ["scholarship", "opportunity", "news", "histoire", "utility"]
      : [type];

  const baseDir = "/tmp/ig_dry_run";
  mkdirSync(baseDir, { recursive: true });

  console.log("═".repeat(70));
  console.log("📸 IG Pipeline Dry-Run");
  console.log("═".repeat(70));
  console.log(`  Types:  ${types.join(", ")}`);
  console.log(`  Output: ${baseDir}`);
  console.log("─".repeat(70));

  for (const igType of types) {
    const item = MOCK_ITEMS[igType];
    console.log(`\n▶ Processing: ${igType.toUpperCase()}`);
    console.log(`  Title: ${item.title}`);

    // ── Step 1: Selection ────────────────────────────────────────────────
    const decision = decideIG(item);
    console.log(`  ✅ Selection: eligible=${decision.igEligible}, type=${decision.igType}, score=${decision.igPriorityScore}`);
    for (const r of decision.reasons) {
      console.log(`     • ${r}`);
    }

    if (!decision.igEligible || !decision.igType) {
      console.log(`  ⏭️  Skipped (not eligible)`);
      continue;
    }

    // ── Step 2: Formatting ───────────────────────────────────────────────
    const payload: IGFormattedPayload = formatForIG(decision.igType, item);
    console.log(`  ✅ Formatted: ${payload.slides.length} slides, caption ${payload.caption.length} chars`);

    // ── Step 3: Render HTML slides ───────────────────────────────────────
    const itemDir = join(baseDir, igType);
    mkdirSync(itemDir, { recursive: true });

    const slidePaths: string[] = [];
    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildSlideHTML(slide, igType, i, payload.slides.length);
      const htmlPath = join(itemDir, `slide_${i + 1}.html`);
      writeFileSync(htmlPath, html, "utf-8");
      slidePaths.push(htmlPath);
    }
    console.log(`  ✅ Rendered: ${slidePaths.length} HTML slides → ${itemDir}`);

    // ── Step 4: Write payload + manifest ─────────────────────────────────
    const payloadPath = join(itemDir, "payload.json");
    writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf-8");

    const mockQueueItem: Partial<IGQueueItem> = {
      id: `dry-run-${igType}`,
      sourceContentId: item.id,
      igType: decision.igType,
      score: decision.igPriorityScore,
      status: "scheduled_ready_for_manual",
      reasons: decision.reasons,
    };

    const manifest = {
      mode: "dry-run",
      queueItem: mockQueueItem,
      slidePaths,
      payloadPath,
      caption: payload.caption,
      generatedAt: new Date().toISOString(),
    };
    const manifestPath = join(itemDir, "publish_manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    console.log(`  ✅ Manifest: ${manifestPath}`);

    // ── Print caption preview ────────────────────────────────────────────
    console.log(`\n  📝 Caption preview (first 300 chars):`);
    console.log(`  ${"-".repeat(50)}`);
    const preview = payload.caption.slice(0, 300);
    for (const line of preview.split("\n")) {
      console.log(`  │ ${line}`);
    }
    console.log(`  ${"-".repeat(50)}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("📊 DRY-RUN SUMMARY");
  console.log("═".repeat(70));
  console.log(`  Output directory: ${baseDir}`);
  console.log(`  Types processed:  ${types.join(", ")}`);
  console.log("");
  console.log("  Open any slide_*.html in a browser to preview the 1080×1080 carousel.");
  console.log("  To enable real IG posting, set IG_ACCESS_TOKEN and IG_USER_ID env vars.");
  console.log("═".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ ig:dry-run failed:", err);
    process.exit(1);
  });
