/**
 * UI-only suppression of "taux du jour" exchange-rate articles.
 *
 * The TauxDuJourWidget replaces these articles, so we hide them
 * from every feed surface to avoid duplication.
 *
 * Heuristic: title/summary must strongly match "taux du jour" phrasing.
 * We require the phrase "taux du jour" OR ("taux" + one of "usd"/
 * "dollar"/"gourde"/"brh") to avoid removing legitimate economy articles.
 */

interface TauxFilterInput {
  title?: string;
  summary?: string;
}

/**
 * Returns `true` when an article looks like a "taux du jour" exchange-rate
 * post from a third-party publisher (e.g. Juno7 or any aggregator).
 *
 * Use this to exclude such articles from feed rendering — the
 * TauxDuJourWidget is the single source for exchange-rate info.
 */
export function isTauxDuJourArticle(item: TauxFilterInput): boolean {
  const text = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();

  // Strong match: the exact phrase "taux du jour"
  if (text.includes("taux du jour")) return true;

  // Composite match: "taux" + exchange-specific keyword
  if (
    text.includes("taux") &&
    (/\busd\b/.test(text) ||
      text.includes("dollar") ||
      text.includes("gourde") ||
      /\bbrh\b/.test(text) ||
      text.includes("taux de référence") ||
      text.includes("taux de reference"))
  ) {
    return true;
  }

  return false;
}
