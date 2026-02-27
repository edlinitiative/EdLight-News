/**
 * BRH "Taux du jour" scraper — server-side only.
 *
 * Fetches https://www.brh.ht/taux-du-jour/ and parses the exchange-rate
 * table from the HTML.  Returns a TauxBRH object or null if anything fails.
 *
 * This is called at page-render time (ISR / on-demand) and benefits from
 * Next.js `revalidate` caching — no new API routes or ingestion pipelines.
 */

import type { TauxBRH } from "@/components/TauxDuJourWidget";

const BRH_URL = "https://www.brh.ht/taux-du-jour/";

/**
 * Fetch today's BRH exchange rates.
 * Gracefully returns `null` on any failure so the widget shows its
 * placeholder state.
 */
export async function fetchTauxBRH(): Promise<TauxBRH | null> {
  try {
    const res = await fetch(BRH_URL, {
      next: { revalidate: 3600 }, // cache for 1 h (page-level revalidate may be shorter)
      headers: {
        "User-Agent": "EdLightNews/1.0 (educational; +https://edlightnews.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    return parseBRHPage(html);
  } catch (err) {
    console.error("[EdLight] BRH taux fetch failed:", err);
    return null;
  }
}

// ── HTML parser ─────────────────────────────────────────────────────────────

/**
 * Extract rates from the raw HTML of the BRH "taux du jour" page.
 *
 * The page contains an HTML table with rows like:
 *   TAUX DE REFERENCE | 130.7745 | - | -
 *   MARCHE BANCAIRE   | 130.4576 | 131.7062 | …
 *   MARCHE INFORMEL   | 131.2500 | 136.2500 | …
 *
 * And a date string like "Taux du Jour : 27 Février 2026".
 */
function parseBRHPage(html: string): TauxBRH | null {
  // Strip HTML tags to get readable text for easier regex matching
  const text = html
    .replace(/<[^>]+>/g, " ")   // tags → space
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");      // collapse whitespace

  // ── Date ───────────────────────────────────────────────────────────────
  const dateMatch = text.match(
    /Taux\s+du\s+Jour\s*:\s*(\d{1,2}\s+\w+\s+\d{4})/i,
  );
  const date = dateMatch?.[1]?.trim() ?? undefined;

  // ── Reference rate ─────────────────────────────────────────────────────
  const refMatch = text.match(
    /TAUX\s+DE\s+R[EÉ]F[EÉ]RENCE\s+([\d.,]+)/i,
  );
  const usdReference = parseRate(refMatch?.[1]);

  // ── Bank market (achat / vente) ────────────────────────────────────────
  const bankMatch = text.match(
    /MARCH[EÉ]\s+BANCAIRE\s+([\d.,]+)\s+([\d.,]+)/i,
  );
  const bankBuy = parseRate(bankMatch?.[1]);
  const bankSell = parseRate(bankMatch?.[2]);

  // ── Informal market (achat / vente) ────────────────────────────────────
  const informalMatch = text.match(
    /MARCH[EÉ]\s+INFORMEL\s+([\d.,]+)\s+([\d.,]+)/i,
  );
  const informalBuy = parseRate(informalMatch?.[1]);
  const informalSell = parseRate(informalMatch?.[2]);

  // If we couldn't even get the reference rate, treat as failure
  if (usdReference == null) return null;

  return {
    date,
    usdReference,
    bankBuy,
    bankSell,
    informalBuy,
    informalSell,
    updatedAt: new Date().toISOString(),
    sourceUrl: BRH_URL,
  };
}

/** Parse a numeric string like "130.7745" or "131,2500" into a number. */
function parseRate(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
