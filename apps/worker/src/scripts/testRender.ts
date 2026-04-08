/**
 * Visual test: render one sample carousel slide per layout type (headline,
 * explanation, data) for scholarship and news igTypes. Saves PNGs to /tmp/ig_test/
 * and reports file paths so you can inspect them.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { buildSlideHtml, adaptLegacyPayload } from "@edlight-news/renderer/ig-engine.js";
import type { IGSlide, IGPostType } from "@edlight-news/types";

const OUT_DIR = "/tmp/ig_test";

const sampleSlides: Array<{ name: string; igType: string; index: number; total: number; slide: IGSlide }> = [
  {
    name: "scholarship_cover_headline",
    igType: "scholarship",
    index: 0,
    total: 4,
    slide: {
      heading: "Bourse SOAS — Études en Développement International",
      bullets: ["🎓 Master · Londres · Sept 2026", "📍 Ouvert aux étudiants haïtiens"],
      footer: "Source: soas.ac.uk",
      layout: "headline",
      backgroundImage: "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=1200",
    },
  },
  {
    name: "scholarship_eligibility_explanation",
    igType: "scholarship",
    index: 1,
    total: 4,
    slide: {
      heading: "Éligibilité & Conditions",
      bullets: [
        "• Détenir un diplôme de licence (baccalauréat)",
        "• Nationalité haïtienne ou résidence permanente",
        "• Score TOEFL iBT ≥ 90 ou IELTS ≥ 6.5",
        "• Lettre de motivation en anglais (500 mots max)",
      ],
      footer: "Source: soas.ac.uk",
      layout: "explanation",
    },
  },
  {
    name: "scholarship_data_coverage",
    igType: "scholarship",
    index: 2,
    total: 4,
    slide: {
      heading: "COUVERTURE",
      bullets: ["Frais de scolarité + allocation mensuelle"],
      footer: "Source: soas.ac.uk",
      layout: "data",
      statValue: "$42,000",
      statDescription: "Couverture totale incluant frais de scolarité, logement et allocation mensuelle",
    },
  },
  {
    name: "news_cover_headline",
    igType: "news",
    index: 0,
    total: 3,
    slide: {
      heading: "Conseil Électoral Provisoire instauré",
      bullets: ["Un pas vers les élections en Haïti"],
      footer: "Source: Le Nouvelliste",
      layout: "headline",
      backgroundImage: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200",
    },
  },
  {
    name: "news_beat_headline",
    igType: "news",
    index: 1,
    total: 3,
    slide: {
      heading: "Les partis politiques réagissent à la décision du Premier ministre",
      bullets: [
        "La société civile salue l'annonce mais demande des garanties de transparence dans le processus.",
        "Le calendrier électoral reste à déterminer selon les observateurs internationaux.",
      ],
      footer: "Source: Le Nouvelliste",
      layout: "headline",
    },
  },
  {
    name: "opportunity_cover_headline",
    igType: "opportunity",
    index: 0,
    total: 3,
    slide: {
      heading: "Stage ONU — Programme Jeunesse 2026",
      bullets: ["🌍 New York · Genève · Nairobi", "📅 Date limite : 15 avril 2026"],
      footer: "Source: careers.un.org",
      layout: "headline",
      backgroundImage: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1200",
    },
  },
  {
    name: "histoire_cover_headline",
    igType: "histoire",
    index: 0,
    total: 3,
    slide: {
      heading: "La Citadelle Laferrière",
      bullets: ["Symbole de la liberté haïtienne depuis 1820"],
      footer: "Source: UNESCO",
      layout: "headline",
      backgroundImage: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=1200",
    },
  },
  {
    name: "utility_explanation",
    igType: "utility",
    index: 1,
    total: 3,
    slide: {
      heading: "Comment renouveler votre passeport",
      bullets: [
        "1. Rassembler les pièces nécessaires (ancien passeport, acte de naissance, 2 photos)",
        "2. Prendre rendez-vous en ligne sur immigration.gouv.ht",
        "3. Se présenter au bureau le jour du rendez-vous",
        "4. Payer les frais : 4 500 HTG (standard) ou 9 000 HTG (express)",
      ],
      footer: "Source: immigration.gouv.ht",
      layout: "explanation",
    },
  },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const execPath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH ??
    "/home/codespace/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
  const browser = await chromium.launch({
    executablePath: execPath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  console.log(`Rendering ${sampleSlides.length} test slides...\n`);

  for (const s of sampleSlides) {
    // Adapt old IGSlide format to new engine types
    const { intake, rawSlides, contentType } = adaptLegacyPayload(
      { id: "test", sourceContentId: "", igType: s.igType as IGPostType, score: 0, status: "queued", reasons: [] } as any,
      { slides: [s.slide], caption: "" },
    );
    const templateId = intake.contentTypeHint!;
    const html = buildSlideHtml(templateId, rawSlides[0]!, contentType, s.index, s.total);
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
    try {
      await page.setContent(html, { waitUntil: "networkidle", timeout: 30_000 });
      await page.evaluate("document.fonts.ready");
      const buffer = await page.screenshot({ type: "png", timeout: 30_000 });
      const outPath = join(OUT_DIR, `${s.name}.png`);
      writeFileSync(outPath, Buffer.from(buffer));
      console.log(`  ✓ ${s.name}.png  (${s.igType} / ${s.slide.layout})`);
    } catch (e: any) {
      console.error(`  ✗ ${s.name}: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log(`\nAll renders saved to ${OUT_DIR}/`);
  console.log("Inspect them to verify layout quality.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
