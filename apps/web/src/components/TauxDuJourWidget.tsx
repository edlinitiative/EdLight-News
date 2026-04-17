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

"use client";

import type { ContentLanguage } from "@edlight-news/types";
import { BarChart3, ChevronDown } from "lucide-react";
import { useState } from "react";

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
  const [expanded, setExpanded] = useState(false);

  // Check if there are any detailed rates to show
  const hasDetailedRates =
    (data?.bankBuy != null || data?.bankSell != null) ||
    (data?.informalBuy != null || data?.informalSell != null);

  return (
    <div className="relative overflow-hidden rounded-lg border border-amber-200/30 bg-gradient-to-br from-amber-50/50 to-white dark:border-amber-700/20 dark:from-amber-950/20 dark:to-stone-900 shadow-md dark:shadow-lg">
      {/* Premium accent bar */}
      <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-blue-500" />

      <div className="px-4 py-2.5">
        {hasData ? (
          /* ── Premium compact rate display ──────────────────────────── */
          <>
            {/* Header with title and badge */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-stone-900 dark:text-white">
                <BarChart3 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                {t.title}
              </h2>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100/60 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                {data?.updatedAt || data?.date ? t.badgeUpdated : t.badge}
              </span>
            </div>

            {/* Main rate display - compact horizontal layout */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1 flex-1">
                <span className="text-lg font-extrabold tabular-nums text-stone-900 dark:text-white">
                  {data!.usdReference}
                </span>
                <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
                  {t.htgPer}
                </span>
              </div>

              {/* Daily variation badge */}
              {data!.dailyVariation && (() => {
                const raw = data!.dailyVariation.replace(",", ".").replace("%", "").trim();
                const num = parseFloat(raw);
                if (!Number.isFinite(num) || num === 0) return null;
                const up = num > 0;
                return (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums flex-shrink-0 ${
                      up
                        ? "bg-red-50/70 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                        : "bg-emerald-50/70 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    }`}
                  >
                    {up ? "↑" : "↓"} {data!.dailyVariation}
                  </span>
                );
              })()}
            </div>

            {/* Expandable detailed rates */}
            {hasDetailedRates && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 w-full flex items-center justify-between text-[11px] font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors py-1 -mx-1 px-1"
              >
                <span>
                  {expanded ? "−" : "+"} {lang === "fr" ? "Détails" : "Detay"}
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {expanded && hasDetailedRates && (
              <div className="mt-2 pt-2 border-t border-amber-100/50 dark:border-amber-900/30 space-y-1.5">
                {/* Bank rates */}
                {(data!.bankBuy != null || data!.bankSell != null) && (
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      {t.bankTitle}
                    </span>
                    <div className="flex gap-2 tabular-nums">
                      {data!.bankBuy != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-stone-500 dark:text-stone-400">{t.buy}</span> {data!.bankBuy}
                        </span>
                      )}
                      {data!.bankSell != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-stone-500 dark:text-stone-400">{t.sell}</span> {data!.bankSell}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Informal rates */}
                {(data!.informalBuy != null || data!.informalSell != null) && (
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      {t.informalTitle}
                    </span>
                    <div className="flex gap-2 tabular-nums">
                      {data!.informalBuy != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-stone-500 dark:text-stone-400">{t.buy}</span> {data!.informalBuy}
                        </span>
                      )}
                      {data!.informalSell != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-stone-500 dark:text-stone-400">{t.sell}</span> {data!.informalSell}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Source footer */}
            <div className="mt-2 pt-1.5 border-t border-amber-100/50 dark:border-amber-900/30">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
              >
                {t.source}
              </a>
            </div>
          </>
        ) : (
          /* ── Placeholder / empty state ─────────────────────────────── */
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[13px] font-semibold text-stone-700 dark:text-stone-200 mb-0.5">
                {t.title}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {t.unavailable}
              </p>
            </div>
            <a
              href={BRH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 text-[11px] font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 transition-colors"
            >
              {t.seeOnBrh}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
