"use client";

/**
 * FeaturedBourses — Mobile-first premium featured scholarships section.
 *
 * Key improvements:
 *   - Horizontal scroll with snap points on mobile, grid on desktop
 *   - Touch-optimized carousel with slide indicators on mobile
 *   - Premium glass-morphism section header
 *   - Smooth scroll behavior with momentum
 *   - Accessible scroll controls on desktop
 */

import type { ContentLanguage } from "@edlight-news/types";
import { useCallback, useRef, useState, useEffect } from "react";
import { ScholarshipCard } from "./ScholarshipCard";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface FeaturedBoursesProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  saved: string[];
  onToggleSave: (id: string) => void;
}

export function FeaturedBourses({
  scholarships,
  lang,
  saved,
  onToggleSave,
}: FeaturedBoursesProps) {
  const fr = lang === "fr";
  if (scholarships.length === 0) return null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("article")?.offsetWidth ?? 280;
    const gap = 16;
    const scrollAmount = (cardWidth + gap) * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(el);
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    updateScrollButtons();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateScrollButtons);
    };
  }, [updateScrollButtons]);

  // Track active slide on mobile scroll
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll("article");
    if (cards.length === 0) return;
    const scrollCenter = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const parentRect = el.getBoundingClientRect();
      const cardCenter = rect.left - parentRect.left + rect.width / 2;
      const dist = Math.abs(cardCenter - scrollCenter + el.offsetWidth / 2 - el.clientWidth / 2);
      // Simplified: use the card's offset from the scroll container
      const cardLeft = (card as HTMLElement).offsetLeft;
      const dist2 = Math.abs(cardLeft + rect.width / 2 - scrollCenter);
      if (dist2 < minDist) {
        minDist = dist2;
        closest = i;
      }
    });
    setActiveIndex(closest);
    updateScrollButtons();
  };

  return (
    <section className="relative" aria-label={fr ? "Bourses en vedette" : "Bous an vedèt"}>
      {/* ── Premium section header ── */}
      <div className="flex items-center justify-between mb-5 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-2">
          <span className="
            inline-flex items-center gap-1.5
            rounded-xl sm:rounded-lg
            bg-[#3525cd]/8 dark:bg-[#c3c0ff]/10
            px-3 sm:px-2.5 py-1.5 sm:py-1
          ">
            <Sparkles className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-[#3525cd] dark:text-[#c3c0ff]" />
            <span className="text-[12px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#3525cd] dark:text-[#c3c0ff]">
              {fr ? "En vedette" : "An vedèt"}
            </span>
          </span>
          <h2 className="text-[18px] sm:text-lg font-extrabold text-[#1d1b1a] dark:text-white font-display tracking-[-0.02em]">
            {fr ? "Bourses populaires" : "Bous popilè yo"}
          </h2>
        </div>

        {/* Scroll buttons — hidden on mobile, visible on desktop */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="
              rounded-xl p-2
              text-[#464555] dark:text-stone-400
              hover:bg-[#f5f0ee] dark:hover:bg-stone-800
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]
            "
            aria-label={fr ? "Défiler vers la gauche" : "Defile agoch"}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="
              rounded-xl p-2
              text-[#464555] dark:text-stone-400
              hover:bg-[#f5f0ee] dark:hover:bg-stone-800
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]
            "
            aria-label={fr ? "Défiler vers la droite" : "Defile adwat"}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Cards container ── */}
      {/* Mobile: horizontal scroll with snap. Desktop: CSS grid (2 cols). */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="
          /* Mobile: snap-scroll carousel */
          flex sm:grid
          sm:grid-cols-2
          gap-4 sm:gap-5
          overflow-x-auto sm:overflow-visible
          scroll-snap-x-mandatory sm:scroll-snap-none
          scrollbar-hide
          -mx-4 sm:mx-0
          px-4 sm:px-0
          pb-2 sm:pb-0
          /* Touch-friendly momentum */
          [-webkit-overflow-scrolling:touch]
        "
      >
        {scholarships.slice(0, 6).map((scholarship, index) => (
          <article
            key={scholarship.id}
            className="
              scroll-snap-start
              min-w-[280px] sm:min-w-0
              max-w-[85vw] sm:max-w-none
              flex-shrink-0
            "
          >
            <ScholarshipCard
              scholarship={scholarship}
              lang={lang}
              saved={saved.includes(scholarship.id)}
              onToggleSave={onToggleSave}
            />
          </article>
        ))}
      </div>

      {/* ── Mobile slide indicators ── */}
      <div className="flex sm:hidden justify-center gap-1.5 mt-3">
        {scholarships.slice(0, 6).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              const card = el.querySelectorAll("article")[i];
              if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
              }
            }}
            className={`
              h-1.5 rounded-full transition-all duration-300
              ${i === activeIndex
                ? "w-5 bg-[#3525cd] dark:bg-[#c3c0ff]"
                : "w-1.5 bg-[#c7c4d8]/40 dark:bg-stone-700"
              }
            `}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}