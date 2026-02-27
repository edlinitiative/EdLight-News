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
    usdLabel: "Taux de référence USD",
    htgPer: "HTG pour 1 USD",
    bankTitle: "Marché bancaire",
    buy: "Achat",
    sell: "Vente",
    informalTitle: "Marché informel",
    impactTitle: "🎓 Impact étudiant",
    impactItems: [
      "Paiement TOEFL / SAT",
      "Frais universitaires à l'étranger",
      "Bourses en USD",
    ],
    unavailable: "Taux BRH indisponible pour le moment.",
    source: "Source : Banque de la République d'Haïti (BRH)",
    seeOnBrh: "Voir sur brh.ht",
  },
  ht: {
    title: "📊 To BRH pou jodi a",
    badge: "Jodi a",
    badgeUpdated: "Mizajou",
    usdLabel: "To referans USD",
    htgPer: "HTG pou 1 USD",
    bankTitle: "Mache bankè",
    buy: "Achte",
    sell: "Vann",
    informalTitle: "Mache enfòmèl",
    impactTitle: "🎓 Sa sa vle di pou elèv",
    impactItems: [
      "Peye TOEFL / SAT",
      "Frè inivèsite aletranje",
      "Bous an USD",
    ],
    unavailable: "To BRH pa disponib kounye a.",
    source: "Sous : Bank de la Repiblik d Ayiti (BRH)",
    seeOnBrh: "Wè sou brh.ht",
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
    <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500" />

      <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-bold text-stone-900 dark:text-white sm:text-base">
            {t.title}
          </h2>
          {/* "Aujourd'hui" / "Mis à jour" badge */}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            {data?.updatedAt || data?.date ? t.badgeUpdated : t.badge}
          </span>
        </div>

        {hasData ? (
          /* ── Active state: rates + impact ──────────────────────────── */
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
            {/* LEFT: Rates */}
            <div className="space-y-3">
              {/* Reference rate (prominent) */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  {t.usdLabel}
                </p>
                <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-stone-900 dark:text-white sm:text-3xl">
                  {data!.usdReference}
                  <span className="ml-1.5 text-sm font-medium text-stone-400 dark:text-stone-500">
                    {t.htgPer}
                  </span>
                </p>
                {data!.date && (
                  <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                    {data!.date}
                  </p>
                )}
              </div>

              {/* Bank & informal rates (optional rows) */}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(data!.bankBuy != null || data!.bankSell != null) && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      {t.bankTitle}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-sm tabular-nums">
                      {data!.bankBuy != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">
                            {t.buy}{" "}
                          </span>
                          {data!.bankBuy}
                        </span>
                      )}
                      {data!.bankSell != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">
                            {t.sell}{" "}
                          </span>
                          {data!.bankSell}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(data!.informalBuy != null || data!.informalSell != null) && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      {t.informalTitle}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-sm tabular-nums">
                      {data!.informalBuy != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">
                            {t.buy}{" "}
                          </span>
                          {data!.informalBuy}
                        </span>
                      )}
                      {data!.informalSell != null && (
                        <span className="text-stone-700 dark:text-stone-300">
                          <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">
                            {t.sell}{" "}
                          </span>
                          {data!.informalSell}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Impact étudiant */}
            <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/60 sm:w-56">
              <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                {t.impactTitle}
              </p>
              <ul className="mt-1.5 space-y-1">
                {t.impactItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-1.5 text-xs text-stone-600 dark:text-stone-400"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          /* ── Placeholder / empty state ─────────────────────────────── */
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
                <span className="text-lg">💱</span>
              </div>
              <div>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {t.unavailable}
                </p>
                <a
                  href={BRH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {t.seeOnBrh} ↗
                </a>
              </div>
            </div>

            {/* Impact section still shows in placeholder */}
            <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/60 sm:w-56">
              <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                {t.impactTitle}
              </p>
              <ul className="mt-1.5 space-y-1">
                {t.impactItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-1.5 text-xs text-stone-600 dark:text-stone-400"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Source footer */}
        <div className="mt-3 border-t border-stone-100 pt-2 dark:border-stone-800">
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
