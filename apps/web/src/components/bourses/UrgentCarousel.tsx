"use client";

/**
 * UrgentCarousel — "À ne pas manquer" horizontal deadline rail.
 *
 * Compact, deadline-first cards for scholarships closing soon: a colour-coded
 * left border (red = urgent, amber = soon), country · level eyebrow, title,
 * funding chip, and a deadline date + J-XX countdown badge. Scrolls
 * horizontally with snap points; prev/next controls on desktop.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Timer, ChevronLeft, ChevronRight, Bookmark, CalendarDays } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { countryCode, fundingLabel, levelBadges } from "@/lib/bourses/labels";
import { getDeadlineStatus, formatDeadlineDateShort } from "@/lib/ui/deadlines";

interface UrgentCarouselProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  saved: string[];
  onToggleSave: (id: string) => void;
}

export function UrgentCarousel({ scholarships, lang, saved, onToggleSave }: UrgentCarouselProps) {
  const fr = lang === "fr";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateButtons);
    observer.observe(el);
    el.addEventListener("scroll", updateButtons, { passive: true });
    updateButtons();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateButtons);
    };
  }, [updateButtons]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("[data-urgent-card]") as HTMLElement | null;
    const amount = (card?.offsetWidth ?? 300) + 16;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (scholarships.length === 0) return null;

  return (
    <section className="relative" aria-label={fr ? "À ne pas manquer" : "Pa manke sa yo"}>
      <div className="mb-4 flex items-end justify-between border-b border-[#f3ecea] pb-2 dark:border-stone-800">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-extrabold tracking-[-0.02em] text-[#1d1b1a] dark:text-white">
          <Timer className="h-5 w-5 text-[#93000a] dark:text-red-400" />
          {fr ? "À ne pas manquer" : "Pa manke sa yo"}
        </h2>
        <div className="hidden items-center gap-1 sm:flex">
          <button
            onClick={() => scroll("left")}
            disabled={!canLeft}
            className="rounded-full border border-[#e7e1de] p-1.5 text-[#464555] transition-colors hover:bg-[#f5f0ee] disabled:opacity-30 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
            aria-label={fr ? "Précédent" : "Anvan"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canRight}
            className="rounded-full border border-[#e7e1de] p-1.5 text-[#464555] transition-colors hover:bg-[#f5f0ee] disabled:opacity-30 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
            aria-label={fr ? "Suivant" : "Apre"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-hide -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:px-0"
      >
        {scholarships.map((s) => {
          const dl = getDeadlineStatus(s.deadline?.dateISO, lang);
          const urgent = dl.badgeVariant === "today" || dl.badgeVariant === "urgent";
          const funding = fundingLabel(s.fundingType, lang);
          const levels = levelBadges(s.level, lang);
          const dateShort = formatDeadlineDateShort(s.deadline?.dateISO, lang);
          const detailHref = `/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`;
          return (
            <Link
              key={s.id}
              data-urgent-card
              href={detailHref}
              className={`group flex min-w-[280px] max-w-[320px] snap-start flex-col gap-2.5 rounded-2xl border border-[#f3ecea] bg-white p-4 shadow-[0_1px_3px_rgba(29,27,26,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(29,27,26,0.18)] dark:border-stone-800 dark:bg-stone-900/95 dark:shadow-none ${
                urgent ? "border-l-4 border-l-[#93000a] dark:border-l-red-500" : "border-l-4 border-l-amber-500"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-[#a8a29e] dark:text-stone-500">
                  {countryCode(s.country)}
                  {levels[0] ? ` · ${levels[0]}` : ""}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleSave(s.id);
                  }}
                  className={`-mr-1 -mt-1 shrink-0 rounded-lg p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] ${
                    saved.includes(s.id)
                      ? "text-[#3525cd] dark:text-[#c3c0ff]"
                      : "text-[#c7c4d8] hover:text-[#6b6563] dark:text-stone-600 dark:hover:text-stone-300"
                  }`}
                  aria-label={fr ? "Sauvegarder" : "Anrejistre"}
                >
                  <Bookmark className={`h-4 w-4 ${saved.includes(s.id) ? "fill-current" : ""}`} />
                </button>
              </div>

              <h3 className="line-clamp-2 font-display text-[14.5px] font-bold leading-snug text-[#1d1b1a] transition-colors group-hover:text-[#3525cd] dark:text-white dark:group-hover:text-[#c3c0ff]">
                {s.name}
              </h3>

              {funding && (
                <span className="inline-flex w-max items-center gap-1.5 rounded-md border border-[#3525cd]/20 bg-[#3525cd]/8 px-2 py-0.5 text-[11px] font-semibold text-[#3525cd] dark:border-[#c3c0ff]/25 dark:bg-[#c3c0ff]/10 dark:text-[#c3c0ff]">
                  {funding.text}
                </span>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6b6563] dark:text-stone-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {dateShort ?? (fr ? "À confirmer" : "Pou verifye")}
                </span>
                {dl.daysLeft != null && dl.daysLeft >= 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${
                      urgent
                        ? "bg-[#93000a]/10 text-[#93000a] dark:bg-red-900/40 dark:text-red-400"
                        : "bg-amber-500/15 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                    }`}
                  >
                    J-{dl.daysLeft}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
