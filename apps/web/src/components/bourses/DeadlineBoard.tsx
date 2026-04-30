"use client";

/**
 * DeadlineBoard — Mobile-first premium upcoming deadlines section.
 *
 * Key improvements:
 *   - Horizontal scroll with snap on mobile, vertical stack on desktop
 *   - Countdown-style urgency with premium amber/gold palette
 *   - Touch-friendly compact cards
 *   - Slide indicators on mobile
 *   - Accessible countdown labels
 */

import type { ContentLanguage } from "@edlight-news/types";
import { useRef, useState, useEffect, useCallback } from "react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { Clock, CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface DeadlineBoardProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  max?: number;
}

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  try {
    const target = new Date(dateStr);
    const now = new Date();
    // Reset time to compare dates only
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function formatDeadline(dateStr: string | undefined, lang: ContentLanguage): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const locale = lang === "fr" ? "fr-FR" : "ht-HT";
    return d.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function DeadlineBoard({ scholarships, lang, max = 8 }: DeadlineBoardProps) {
  const fr = lang === "fr";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const sorted = scholarships
    .map((s) => ({ ...s, daysLeft: daysUntil(s.deadline?.dateISO) }))
    .filter((s) => s.daysLeft !== null && s.daysLeft >= 0)
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity))
    .slice(0, max);

  if (sorted.length === 0) return null;

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = 300;
    const gap = 16;
    el.scrollBy({ left: (cardW + gap) * (dir === "left" ? -1 : 1), behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    updateScrollButtons();
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollButtons);
    };
  }, [updateScrollButtons]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll("article");
    if (!cards.length) return;
    const scrollCenter = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const left = (card as HTMLElement).offsetLeft;
      const w = card.getBoundingClientRect().width;
      const dist = Math.abs(left + w / 2 - scrollCenter);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveIndex(closest);
    updateScrollButtons();
  };

  const urgencyColor = (days: number | null): string => {
    if (days === null) return "";
    if (days <= 7) return "text-[#93000a] dark:text-red-400 bg-[#93000a]/8 dark:bg-red-400/10 border-[#93000a]/20 dark:border-red-400/20";
    if (days <= 30) return "text-[#bd6b00] dark:text-amber-400 bg-[#bd6b00]/8 dark:bg-amber-400/10 border-[#bd6b00]/20 dark:border-amber-400/20";
    return "text-[#2b6e13] dark:text-emerald-400 bg-[#2b6e13]/8 dark:bg-emerald-400/10 border-[#2b6e13]/20 dark:border-emerald-400/20";
  };

  return (
    <section aria-label={fr ? "Dates limites imminentes" : "Dat limit iminan"}>
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-4 sm:mb-4">
        <div className="flex items-center gap-2.5 sm:gap-2">
          <span className="
            inline-flex items-center gap-1.5
            rounded-xl sm:rounded-lg
            bg-[#bd6b00]/8 dark:bg-amber-400/10
            px-3 sm:px-2.5 py-1.5 sm:py-1
          ">
            <Clock className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-[#bd6b00] dark:text-amber-400" />
            <span className="text-[12px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#bd6b00] dark:text-amber-400">
              {fr ? "Dates limites" : "Dat limit"}
            </span>
          </span>
          <h2 className="text-[17px] sm:text-lg font-extrabold text-[#1d1b1a] dark:text-white font-display tracking-[-0.02em] leading-tight">
            {fr ? "À ne pas manquer" : "Pa rate yo"}
          </h2>
        </div>

        {/* Desktop scroll controls */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="rounded-xl p-2 text-[#464555] dark:text-stone-400 hover:bg-[#f5f0ee] dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bd6b00]"
            aria-label={fr ? "Défiler vers la gauche" : "Defile agoch"}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="rounded-xl p-2 text-[#464555] dark:text-stone-400 hover:bg-[#f5f0ee] dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bd6b00]"
            aria-label={fr ? "Défiler vers la droite" : "Defile adwat"}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Horizontal scrollable cards (mobile), vertical wrap (desktop) ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="
          flex sm:grid sm:grid-cols-2 lg:grid-cols-4
          gap-4 sm:gap-4
          overflow-x-auto sm:overflow-visible
          scroll-snap-x-mandatory sm:scroll-snap-none
          scrollbar-hide
          -mx-4 sm:mx-0
          px-4 sm:px-0
          pb-4 sm:pb-0
          [-webkit-overflow-scrolling:touch]
        "
      >
        {sorted.map((s, i) => (
          <article
            key={s.id}
            className="
              scroll-snap-start
              min-w-[280px] sm:min-w-0
              max-w-[82vw] sm:max-w-none
              flex-shrink-0
            "
          >
            <div className="
              group
              bg-white dark:bg-stone-900/95
              rounded-2xl sm:rounded-2xl
              border border-[#f3ecea]/30 dark:border-stone-700/40
              shadow-[0_1px_3px_rgba(29,27,26,0.04)] dark:shadow-none
              hover:shadow-md hover:shadow-[#bd6b00]/5 dark:hover:shadow-amber-400/5
              transition-all duration-300
              overflow-hidden
              h-full flex flex-col
            ">
              {/* ── Top bar with days indicator ── */}
              <div className="p-4 sm:p-4 pb-3 sm:pb-3 flex-1">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="
                    text-[14px] sm:text-[13px] font-extrabold
                    text-[#1d1b1a] dark:text-white
                    leading-snug
                    line-clamp-2
                    group-hover:text-[#bd6b00] dark:group-hover:text-amber-400
                    transition-colors duration-200
                  ">
                    {s.name}
                  </h3>
                </div>

                {/* Country + Level */}
                <p className="text-[11px] sm:text-[10px] font-semibold text-[#6b6563] dark:text-stone-400 mb-2">
                  {s.country} · {s.level?.join(", ") ?? ""}
                </p>

                {/* Funding type */}
                <p className="text-[11px] sm:text-[10px] font-semibold text-[#3525cd] dark:text-[#c3c0ff] mb-3">
                  {s.fundingType === "full" ? (fr ? "Bourse Complète" : "Bous Konplè")
                    : s.fundingType === "partial" ? (fr ? "Bourse Partielle" : "Bous Pasyèl")
                    : s.fundingType === "stipend" ? (fr ? "Allocation" : "Alokasyon")
                    : (fr ? "Scolarité" : "Frè Etid")}
                </p>

                {/* Link */}
                {s.officialUrl && (
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex items-center gap-1
                      text-[11px] sm:text-[10px] font-bold
                      text-[#464555] dark:text-stone-400
                      hover:text-[#3525cd] dark:hover:text-[#c3c0ff]
                      transition-colors duration-200
                      group/link
                    "
                  >
                    {fr ? "Site officiel" : "Sit ofisyèl"}
                    <ExternalLink className="h-3 w-3 sm:h-2.5 sm:w-2.5 group-hover/link:translate-x-0.5 transition-transform duration-200" />
                  </a>
                )}
              </div>

              {/* ── Bottom: Deadline urgency strip ── */}
              <div className={`
                flex items-center justify-between gap-2
                px-4 sm:px-4 py-3 sm:py-2.5
                border-t
                ${urgencyColor(s.daysLeft)}
              `}>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 sm:h-3 sm:w-3 flex-shrink-0" />
                  <span className="text-[11px] sm:text-[10px] font-bold">
                    {formatDeadline(s.deadline?.dateISO, lang)}
                  </span>
                </div>
                <span className="text-[11px] sm:text-[10px] font-extrabold whitespace-nowrap">
                  {s.daysLeft === 0
                    ? (fr ? "Aujourd'hui !" : "Jodi a !")
                    : s.daysLeft === 1
                      ? (fr ? "Demain !" : "Demen !")
                      : fr
                        ? `J-${s.daysLeft}`
                        : `J-${s.daysLeft}`}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* ── Mobile slide indicators ── */}
      <div className="flex sm:hidden justify-center gap-1.5 mt-3">
        {sorted.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              const card = el.querySelectorAll("article")[i];
              if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }}
            className={`
              h-1.5 rounded-full transition-all duration-300
              ${i === activeIndex
                ? "w-5 bg-[#bd6b00] dark:bg-amber-400"
                : "w-1.5 bg-[#c7c4d8]/40 dark:bg-stone-700"
              }
            `}
            aria-label={`${fr ? "Élément" : "Eleman"} ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}