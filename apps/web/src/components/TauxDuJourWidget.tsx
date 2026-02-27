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
    title: "📊 Taux BRH du jour",
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
    title: "📊 To BRH pou jodi a",
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

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      {/* Top accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500" />

      <div className="px-4 py-3 sm:px-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold text-stone-900 dark:text-white sm:text-sm">
            {t.title}
          </h2>
          {/* "Aujourd'hui" / "Mis à jour" badge */}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            {data?.updatedAt || data?.date ? t.badgeUpdated : t.badge}
          </span>
        </div>

        {hasData ? (
          /* ── Active state: flat inline rates ────────────────────────── */
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            {/* Reference rate (prominent) */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold tabular-nums text-stone-900 dark:text-white sm:text-2xl">
                {data!.usdReference}
              </span>
              <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500">
                {t.htgPer}
              </span>
              {data!.dailyVariation && (() => {
                const raw = data!.dailyVariation.replace(",", ".").replace("%", "").trim();
                const num = parseFloat(raw);
                if (!Number.isFinite(num) || num === 0) return null;
                const up = num > 0;
                return (
                  <span
                    className={`ml-0.5 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${
                      up
                        ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                    }`}
                  >
                    {up ? "↑" : "↓"} {data!.dailyVariation}
                  </span>
                );
              })()}
              {data!.weeklyVariation && (() => {
                const raw = data!.weeklyVariation.replace(",", ".").replace("%", "").trim();
                const num = parseFloat(raw);
                if (!Number.isFinite(num) || num === 0) return null;
                const up = num > 0;
                return (
                  <span
                    className={`ml-0.5 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] tabular-nums ${
                      up
                        ? "text-red-400 dark:text-red-500"
                        : "text-emerald-400 dark:text-emerald-500"
                    }`}
                    title={lang === "fr" ? "Variation hebdomadaire" : "Varyasyon semèn"}
                  >
                    {t.weekLabel} {up ? "↑" : "↓"} {data!.weeklyVariation}
                  </span>
                );
              })()}
            </div>

            {/* Divider */}
            <span className="hidden text-stone-200 dark:text-stone-700 sm:inline">|</span>

            {/* Bank rates */}
            {(data!.bankBuy != null || data!.bankSell != null) && (
              <div className="flex items-baseline gap-2 text-xs tabular-nums">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  {t.bankTitle}
                </span>
                {data!.bankBuy != null && (
                  <span className="text-stone-600 dark:text-stone-300">
                    <span className="text-stone-400 dark:text-stone-500">{t.buy}</span> {data!.bankBuy}
                  </span>
                )}
                {data!.bankSell != null && (
                  <span className="text-stone-600 dark:text-stone-300">
                    <span className="text-stone-400 dark:text-stone-500">{t.sell}</span> {data!.bankSell}
                  </span>
                )}
              </div>
            )}

            {/* Informal rates */}
            {(data!.informalBuy != null || data!.informalSell != null) && (
              <div className="flex items-baseline gap-2 text-xs tabular-nums">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  {t.informalTitle}
                </span>
                {data!.informalBuy != null && (
                  <span className="text-stone-600 dark:text-stone-300">
                    <span className="text-stone-400 dark:text-stone-500">{t.buy}</span> {data!.informalBuy}
                  </span>
                )}
                {data!.informalSell != null && (
                  <span className="text-stone-600 dark:text-stone-300">
                    <span className="text-stone-400 dark:text-stone-500">{t.sell}</span> {data!.informalSell}
                  </span>
                )}
              </div>
            )}

            {/* Date */}
            {data!.date && (
              <span className="text-[11px] text-stone-400 dark:text-stone-500">
                {data!.date}
              </span>
            )}
          </div>
        ) : (
          /* ── Placeholder / empty state ─────────────────────────────── */
          <div className="mt-2 flex items-center gap-3">
            <span className="text-base">💱</span>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {t.unavailable}
            </p>
            <a
              href={BRH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {t.seeOnBrh} ↗
            </a>
          </div>
        )}

        {/* Source footer */}
        <div className="mt-2 border-t border-stone-100 pt-1.5 dark:border-stone-800">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
          >
            {t.source} ↗
          </a>
        </div>
      </div>
    </div>
  );
}
