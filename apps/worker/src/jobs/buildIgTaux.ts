/**
 * Worker job: buildIgTaux
 *
 * Produces a branded "Taux du Jour" IG carousel post once per day.
 * Scrapes the BRH (Banque de la République d'Haïti) exchange rate page,
 * formats a carousel, and inserts it into the ig_queue with high priority.
 *
 * Self-gates:
 *  - Only runs between 07:00–09:00 Haiti time (targeting ~8 AM post)
 *  - Skips if a taux post already exists for today
 */

import { igQueueRepo } from "@edlight-news/firebase";
import type { IGFormattedPayload, IGSlide, IGQueueStatus } from "@edlight-news/types";
import { ensureTauxBackground } from "../services/geminiImageGen.js";

// ── Haiti timezone ─────────────────────────────────────────────────────────
const HAITI_TZ = "America/Port-au-Prince";
const BRH_URL = "https://www.brh.ht/taux-du-jour/";

// ── BRH data shape ─────────────────────────────────────────────────────────
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

// ── Result type ────────────────────────────────────────────────────────────
export interface BuildIgTauxResult {
  queued: boolean;
  skipped: string;
}

// ── Time gating ────────────────────────────────────────────────────────────

function toHaitiDate(date: Date): Date {
  const haitiStr = date.toLocaleString("en-US", { timeZone: HAITI_TZ });
  return new Date(haitiStr);
}

function isInTauxWindow(): boolean {
  const haiti = toHaitiDate(new Date());
  const hour = haiti.getHours();
  return hour >= 7 && hour < 9; // 07:00–08:59 Haiti time
}

// ── BRH scraper (self-contained, no Next.js dependency) ────────────────────

async function fetchTauxBRH(): Promise<TauxBRH | null> {
  try {
    const res = await fetch(BRH_URL, {
      headers: {
        "User-Agent": "EdLightNews/1.0 (educational; +https://edlightnews.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseBRHPage(html);
  } catch (err) {
    console.error("[buildIgTaux] BRH fetch failed:", err);
    return null;
  }
}

function parseBRHPage(html: string): TauxBRH | null {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");

  const dateMatch = text.match(/Taux\s+du\s+Jour\s*:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  const date = dateMatch?.[1]?.trim() ?? undefined;

  const refMatch = text.match(/TAUX\s+DE\s+R[EÉ]F[EÉ]RENCE\s+([\d.,]+)/i);
  const usdReference = parseRate(refMatch?.[1]);
  if (usdReference == null) return null;

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

// ── Carousel builder ───────────────────────────────────────────────────────

async function formatTauxCarousel(taux: TauxBRH): Promise<IGFormattedPayload> {
  const slides: IGSlide[] = [];

  const dateLabel = taux.date ?? new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // One-time branded background (generated once, reused forever)
  let bgUrl: string | undefined;
  try {
    bgUrl = (await ensureTauxBackground()) ?? undefined;
  } catch (e) {
    console.warn("[buildIgTaux] Taux background fetch failed:", e);
  }

  // Slide 1: Cover — bold reference rate (rendered BIG by taux template)
  // The heading IS the rate number; the taux renderer displays it at 104px gold
  const coverMeta: string[] = [dateLabel];
  if (taux.dailyVariation) coverMeta.push(`Variation: ${taux.dailyVariation}`);

  slides.push({
    heading: taux.usdReference?.toFixed(4) ?? "—",
    bullets: coverMeta,
    footer: "Source: Banque de la République d'Haïti (BRH)",
    ...(bgUrl ? { backgroundImage: bgUrl } : {}),
  });

  // Slide 2: Markets breakdown (only if we have market data)
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
      ...(bgUrl ? { backgroundImage: bgUrl } : {}),
    });
  }

  // Caption — bilingual, clean (no emojis — they render poorly in some contexts)
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

// ── Main job ───────────────────────────────────────────────────────────────

export async function buildIgTaux(): Promise<BuildIgTauxResult> {
  // Time-gate: only run in the 07–09 Haiti time window
  if (!isInTauxWindow()) {
    return { queued: false, skipped: "outside-taux-window" };
  }

  // Daily-once gate: check if taux post already exists for today
  const todayStr = toHaitiDate(new Date()).toISOString().slice(0, 10);
  const recentTaux = await igQueueRepo.listRecentPosted(1, 20);
  const alreadyPostedToday = recentTaux.some(
    (p) => p.igType === "taux" && p.sourceContentId.startsWith("taux-") && p.sourceContentId.includes(todayStr),
  );

  // Also check if queued/scheduled
  const queued = await igQueueRepo.listQueuedByScore(50);
  const scheduled = await igQueueRepo.listScheduled(20);
  const alreadyInPipeline = [...queued, ...scheduled].some(
    (p) => p.sourceContentId.startsWith("taux-") && p.sourceContentId.includes(todayStr),
  );

  if (alreadyPostedToday || alreadyInPipeline) {
    return { queued: false, skipped: "taux-already-exists-today" };
  }

  // Scrape BRH
  const taux = await fetchTauxBRH();
  if (!taux) {
    console.warn("[buildIgTaux] Could not fetch BRH rates");
    return { queued: false, skipped: "brh-fetch-failed" };
  }

  // Format carousel (async — resolves taux background image)
  const payload = await formatTauxCarousel(taux);

  // Insert into ig_queue with high priority (score 95)
  await igQueueRepo.createIGQueueItem({
    sourceContentId: `taux-${todayStr}`,
    igType: "taux",
    score: 95, // High priority — always posts first
    status: "queued" as IGQueueStatus,
    reasons: [`Branded taux du jour post for ${taux.date ?? todayStr}`],
    payload,
  });

  console.log(`[buildIgTaux] Queued taux du jour post for ${todayStr} (reference=${taux.usdReference})`);
  return { queued: true, skipped: "" };
}
