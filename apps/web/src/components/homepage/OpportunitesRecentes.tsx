/**
 * OpportunitesRecentes — "Dernières opportunités" section.
 *
 * Scholarships posted/updated in the last 7 days. Falls back to the
 * most-recent N scholarships if nothing is < 7d old (so the section
 * never disappears on a quiet week).
 */

import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { withLangParam, formatRelativeDate } from "@/lib/utils";

interface Props {
  bourses: SerializedScholarship[];
  lang: ContentLanguage;
}

export function OpportunitesRecentes({ bourses, lang }: Props) {
  if (bourses.length === 0) return null;
  const fr = lang === "fr";
  const lq = (path: string) => withLangParam(path, lang);

  return (
    <section className="border-b border-stone-200 dark:border-stone-800 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.22em] text-stone-900 dark:text-white">
            {fr ? "Dernières opportunités" : "Dènye opòtinite"}
          </span>
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <Link
            href={lq("/opportunites")}
            className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
          >
            {fr ? "Voir tout" : "Wè tout"} →
          </Link>
        </div>

        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {bourses.slice(0, 6).map((b) => (
            <li key={b.id}>
              <Link
                href={lq(`/bourses/${b.id}`)}
                className="group block"
              >
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                  {b.country}
                  {b.verifiedAtISO && (
                    <>
                      <span className="mx-1.5 text-stone-300 dark:text-stone-700">
                        ·
                      </span>
                      <span className="font-normal text-stone-400">
                        {formatRelativeDate(b.verifiedAtISO, lang)}
                      </span>
                    </>
                  )}
                </p>
                <h3 className="font-serif text-base font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                  {b.name}
                </h3>
                {b.eligibilitySummary && (
                  <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">
                    {b.eligibilitySummary}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
