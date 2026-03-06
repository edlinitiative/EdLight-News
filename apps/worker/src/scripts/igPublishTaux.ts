/**
 * IG Publish Taux — one-shot script to publish taux du jour NOW.
 *
 * Bypasses time-gate and daily-once check. Scrapes BRH, builds carousel,
 * renders slides with the current template, and publishes.
 *
 * Usage:  cd apps/worker && npx tsx src/scripts/igPublishTaux.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo, uploadCarouselSlides } from "@edlight-news/firebase";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { publishIgPost } from "@edlight-news/publisher";
import type { IGFormattedPayload, IGSlide, IGQueueStatus } from "@edlight-news/types";

// ── BRH scraper (copied from buildIgTaux — standalone, no gate) ──────────

const BRH_URL = "https://www.brh.ht/taux-du-jour/";

interface TauxBRH {
  date?: string;
  usdReference?: number;
  dailyVariation?: string;
  weeklyVariation?: string;
  bankBuy?: number;
  bankSell?: number;
  informalBuy?: number;
  informalSell?: number;
}

async function fetchTauxBRH(): Promise<TauxBRH | null> {
  const res = await fetch(BRH_URL, {
    headers: {
      "User-Agent": "EdLightNews/1.0 (educational; +https://edlightnews.com)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`BRH HTTP ${res.status}`);
  const html = await res.text();

  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");

  const dateMatch = text.match(/Taux\s+du\s+Jour\s*:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  const date = dateMatch?.[1]?.trim() ?? undefined;

  const refMatch = text.match(/TAUX\s+DE\s+R[EÉ]F[EÉ]RENCE\s+([\d.,]+)/i);
  const usdReference = parseRate(refMatch?.[1]);
  if (usdReference == null) throw new Error("Could not parse BRH reference rate");

  const refVarMatch = text.match(
    /TAUX\s+DE\s+R[EÉ]F[EÉ]RENCE\s+[\d.,]+.*?Variation\s*\/\s*Jour\s+pr[eé]c[eé]dent\s+(-?[\d.,]+%)/i,
  );
  const dailyVariation = refVarMatch?.[1]?.trim() ?? undefined;

  const weekVarMatch = text.match(
    /TAUX\s+DE\s+R[EÉ]F[EÉ]RENCE\s+[\d.,]+.*?Variation\s*\/\s*Semaine\s+pr[eé]c[eé]dente\s+(-?[\d.,]+%)/i,
  );
  const weeklyVariation = weekVarMatch?.[1]?.trim() ?? undefined;

  const bankMatch = text.match(/MARCH[EÉ]\s+BANCAIRE\s+([\d.,]+)\s+([\d.,]+)/i);
  const bankBuy = parseRate(bankMatch?.[1]);
  const bankSell = parseRate(bankMatch?.[2]);

  const informalMatch = text.match(/MARCH[EÉ]\s+INFORMEL\s+([\d.,]+)\s+([\d.,]+)/i);
  const informalBuy = parseRate(informalMatch?.[1]);
  const informalSell = parseRate(informalMatch?.[2]);

  return { date, usdReference, dailyVariation, weeklyVariation, bankBuy, bankSell, informalBuy, informalSell };
}

function parseRate(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

// ── Build carousel payload ─────────────────────────────────────────────────

function formatTauxCarousel(taux: TauxBRH): IGFormattedPayload {
  const slides: IGSlide[] = [];
  const dateLabel = taux.date ?? new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Slide 1: Cover — bold reference rate
  const coverMeta: string[] = [dateLabel];
  if (taux.dailyVariation) coverMeta.push(`Variation: ${taux.dailyVariation}`);

  slides.push({
    heading: taux.usdReference?.toFixed(4) ?? "—",
    bullets: coverMeta,
    footer: "Source: Banque de la République d'Haïti (BRH)",
  });

  // Slide 2: Markets breakdown
  const marketBullets: string[] = [];
  if (taux.bankBuy != null && taux.bankSell != null) {
    marketBullets.push(`Bancaire — Achat: ${taux.bankBuy.toFixed(4)}  |  Vente: ${taux.bankSell.toFixed(4)}`);
  }
  if (taux.informalBuy != null && taux.informalSell != null) {
    marketBullets.push(`Informel — Achat: ${taux.informalBuy.toFixed(4)}  |  Vente: ${taux.informalSell.toFixed(4)}`);
  }
  if (taux.weeklyVariation) {
    marketBullets.push(`Variation semaine: ${taux.weeklyVariation}`);
  }
  if (marketBullets.length > 0) {
    slides.push({
      heading: "Détail des marchés",
      bullets: marketBullets,
      footer: "brh.ht/taux-du-jour",
    });
  }

  const caption = [
    `Taux BRH du jour — ${dateLabel}`,
    "",
    `Taux de référence: 1 USD = ${taux.usdReference?.toFixed(4) ?? "—"} HTG`,
    ...(taux.dailyVariation ? [`Variation/jour: ${taux.dailyVariation}`] : []),
    ...(taux.bankBuy != null ? [`Bancaire — Achat: ${taux.bankBuy.toFixed(4)} | Vente: ${taux.bankSell?.toFixed(4)}`] : []),
    ...(taux.informalBuy != null ? [`Informel — Achat: ${taux.informalBuy.toFixed(4)} | Vente: ${taux.informalSell?.toFixed(4)}`] : []),
    "",
    "To BRH pou jodi a",
    `1 USD = ${taux.usdReference?.toFixed(4) ?? "—"} HTG`,
    "",
    "→ Détails sur EdLight News — lien dans la bio",
    "→ Detay sou EdLight News — lyen nan biyo",
    "",
    "Source: BRH (brh.ht)",
    "",
    "#TauxDuJour #BRH #Haiti #USD #HTG #EdLightNews #Gourde #Dollar",
  ].join("\n");

  return { slides, caption };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== IG Publish Taux — Force Publish ===\n");

  const hasToken = !!process.env.IG_ACCESS_TOKEN;
  const hasUser = !!process.env.IG_USER_ID;
  console.log(`IG_ACCESS_TOKEN: ${hasToken ? "✓ set" : "✗ MISSING"}`);
  console.log(`IG_USER_ID: ${hasUser ? "✓ set" : "✗ MISSING"}\n`);
  if (!hasToken || !hasUser) {
    console.error("Missing IG credentials. Set IG_ACCESS_TOKEN and IG_USER_ID in .env");
    process.exit(1);
  }

  // Step 1: Scrape BRH
  console.log("--- Step 1: Fetch BRH rates ---");
  const taux = await fetchTauxBRH();
  if (!taux) {
    console.error("Failed to fetch BRH rates");
    process.exit(1);
  }
  console.log(`  Reference: ${taux.usdReference}`);
  console.log(`  Date: ${taux.date ?? "unknown"}`);
  console.log(`  Daily Var: ${taux.dailyVariation ?? "n/a"}`);

  // Step 2: Build payload & queue item
  console.log("\n--- Step 2: Build carousel payload ---");
  const payload = formatTauxCarousel(taux);
  console.log(`  ${payload.slides.length} slides`);

  const todayStr = new Date().toISOString().slice(0, 10);
  const queueId = `taux-force-${todayStr}-${Date.now()}`;

  const queueItem = await igQueueRepo.createIGQueueItem({
    sourceContentId: queueId,
    igType: "taux",
    score: 99,
    status: "queued" as IGQueueStatus,
    reasons: [`Force-published taux du jour (${taux.date ?? todayStr})`],
    payload,
  });

  console.log(`  Queue item: ${queueItem.id}`);

  // Step 3: Render
  console.log("\n--- Step 3: Render carousel ---");
  await igQueueRepo.updateStatus(queueItem.id, "rendering");
  const assets = await generateCarouselAssets(queueItem, payload);
  console.log(`  Rendered ${assets.slidePaths.length} slides (mode=${assets.mode})`);

  // Step 4: Upload to Firebase Storage
  let slideUrls = assets.slidePaths;
  if (assets.mode === "rendered") {
    console.log("\n--- Step 4: Upload slides ---");
    slideUrls = await uploadCarouselSlides(assets.slidePaths, queueItem.id);
    console.log(`  Uploaded ${slideUrls.length} slides`);
  }

  // Step 5: Publish to Instagram
  console.log("\n--- Step 5: Publish to Instagram ---");
  const result = await publishIgPost(queueItem, payload, slideUrls);
  console.log("  Result:", JSON.stringify(result, null, 2));

  if (result.posted) {
    await igQueueRepo.markPosted(queueItem.id, result.igPostId);
    console.log(`\n✓ POSTED: ${result.igPostId}`);
  } else if (result.dryRun) {
    console.log(`\n⚠ DRY RUN: ${result.dryRunPath}`);
  } else {
    console.error(`\n✗ FAILED: ${result.error}`);
    await igQueueRepo.updateStatus(queueItem.id, "queued");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
