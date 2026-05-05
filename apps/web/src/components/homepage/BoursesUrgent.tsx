/**
 * BoursesUrgent — "Bourses qui ferment bientôt" section.
 *
 * Up to 6 deadline-imminent scholarships, urgency-styled.
 * Server component.
 */

import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { withLangParam } from "@/lib/utils";
import {
  parseISODateSafe,
  daysUntil,
  formatDaysLabel,
  urgencyTier,
} from "@/lib/deadlines";

interface Props {
  bourses: SerializedScholarship[];
  lang: ContentLanguage;
}

function urgencyBg(tier: ReturnType<typeof urgencyTier>): string {
  switch (tier) {
    case "critical":
      return "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20";
    case "soon":
      return "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20";
    default:
      return "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900/40";
  }
}

function urgencyText(tier: ReturnType<typeof urgencyTier>): string {
  switch (tier) {
    case "critical":
      return "text-red-700 dark:text-red-300";
    case "soon":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-emerald-700 dark:text-emerald-300";
  }
}

export function BoursesUrgent({ bourses, lang }: Props) {
  if (bourses.length === 0) return null;
  const fr = lang === "fr";
  const lq = (path: string) => withLangParam(path, lang);

  return (
    <section className="border-b border-stone-200 dark:border-stone-800 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.22em] text-stone-900 dark:text-white">
            {fr ? "Bourses qui ferment bientôt" : "Bous ki fèmen byento"}
          </span>
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <Link
            href={lq("/closing-soon")}
            className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
          >
            {fr ? "Voir tout" : "Wè tout"} →
          </Link>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bourses.slice(0, 6).map((b) => {
            const iso = b.deadline?.dateISO;
            const date = iso ? parseISODateSafe(iso) : null;
            const days = date ? daysUntil(date) : null;
            const tier =
              days !== null && days >= 0 ? urgencyTier(days) : "none";
            const label =
              days !== null && days >= 0
                ? formatDaysLabel(days, lang, { fr: "Ferme", ht: "Fèmen" })
                : null;

            return (
              <li key={b.id}>
                <Link
                  href={lq(`/bourses/${b.id}`)}
                  className={[
                    "group flex h-full flex-col rounded-lg border p-4 transition-shadow hover:shadow-sm",
                    urgencyBg(tier),
                  ].join(" ")}
                >
                  {label && (
                    <span
                      className={[
                        "mb-2 text-[10px] font-black uppercase tracking-[0.16em] tabular-nums",
                        urgencyText(tier),
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  )}
                  <h3 className="font-serif text-base font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors line-clamp-3">
                    {b.name}
                  </h3>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    {b.country}
                    {b.fundingType ? (
                      <>
                        <span className="mx-1.5 text-stone-300 dark:text-stone-700">
                          ·
                        </span>
                        {b.fundingType}
                      </>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
