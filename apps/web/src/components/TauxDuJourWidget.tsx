/**
 * TauxDuJourWidget — "📊 Taux BRH du jour" daily utility widget.
 *
 * Displays the latest BRH (Banque de la République d'Haïti) exchange rate
 * in a premium compact card. This is a UI-only feature component —
 * no backend, no Firestore writes, no new API routes.
 *
 * If no data is wired yet, the widget renders a graceful placeholder state
 * with a link to the BRH page.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { BarChart3 } from "lucide-react";

// ── Minimal UI type (no backend dependency) ─────────────────────────────────

export type TauxBRH = {
  date?: string;
  usdReference?: number | string;
  /** Daily variation of the reference rate, e.g. "-0.06%" */
  dailyVariation?: string;
  /** Weekly variation of the reference rate, e.g. "-0.07%" */
  weeklyVariation?: string;
  bankBuy?: number | string;
  bankSell?: number | string;
  informalBuy?: number | string;
  informalSell?: number | string;
  updatedAt?: string;
  sourceUrl?: string;
};

// ── i18n strings ────────────────────────────────────────────────────────────

const STRINGS = {
  fr: {
    title: "Taux BRH du jour",
    badge: "Aujourd'hui",
    badgeUpdated: "Mis à jour",
    htgPer: "HTG pour 1 USD",
    bankTitle: "Marché bancaire",
    buy: "Achat",
    sell: "Vente",
    informalTitle: "Marché informel",
    unavailable: "Taux BRH indisponible pour le moment.",
    source: "Source : Banque de la République d'Haïti (BRH)",
    seeOnBrh: "Voir sur brh.ht",
    weekLabel: "sem.",
  },
  ht: {
    title: "To BRH pou jodi a",
    badge: "Jodi a",
    badgeUpdated: "Mizajou",
    htgPer: "HTG pou 1 USD",
    bankTitle: "Mache bankè",
    buy: "Achte",
    sell: "Vann",
    informalTitle: "Mache enfòmèl",
    unavailable: "To BRH pa disponib kounye a.",
    source: "Sous : Bank de la Repiblik d Ayiti (BRH)",
    seeOnBrh: "Wè sou brh.ht",
    weekLabel: "sem.",
  },
} as const;

const BRH_URL = "https://www.brh.ht/taux-du-jour/";

// ── Widget component ────────────────────────────────────────────────────────

interface TauxDuJourWidgetProps {
  lang: ContentLanguage;
  data?: TauxBRH | null;
}

export function TauxDuJourWidget({ lang, data }: TauxDuJourWidgetProps) {
  const t = STRINGS[lang] ?? STRINGS.fr;
  const hasData = data && data.usdReference != null;
  const sourceUrl = data?.sourceUrl ?? BRH_URL;

  // Compact daily-variation chip (only when non-zero).
  const variationChip = (() => {
    if (!data?.dailyVariation) return null;
    const num = parseFloat(data.dailyVariation.replace(",", ".").replace("%", "").trim());
    if (!Number.isFinite(num) || num === 0) return null;
    const up = num > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 tabular-nums font-semibold ${up ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
        {up ? "↑" : "↓"} {data.dailyVariation}
      </span>
    );
  })();

  // Minimal single-line strip — just the reference rate, no card / no fill.
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-stone-500 dark:text-stone-400">
      <span className="inline-flex items-center gap-1.5 font-semibold text-stone-700 dark:text-stone-200">
        <BarChart3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        {t.title}
      </span>
      {hasData ? (
        <>
          <span className="font-bold tabular-nums text-stone-900 dark:text-white">{data!.usdReference}</span>
          <span className="text-[11px]">{t.htgPer}</span>
          {variationChip}
        </>
      ) : (
        <span>{t.unavailable}</span>
      )}
      <span className="text-stone-300 dark:text-stone-600">·</span>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-stone-700 dark:hover:text-stone-200"
      >
        BRH ↗
      </a>
    </div>
  );
}
