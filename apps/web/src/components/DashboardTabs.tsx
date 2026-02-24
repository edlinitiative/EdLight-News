"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type TouchEvent as RTE,
} from "react";
import {
  DollarSign,
  CalendarDays,
  Compass,
  BookOpen,
  Newspaper,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Tab definitions ──────────────────────────────────────────────────────────

const TAB_DEFS = [
  { id: "bourses", fr: "Bourses ouvertes", ht: "Bous ouvè", Icon: DollarSign },
  { id: "calendrier", fr: "Calendrier", ht: "Kalandriye", Icon: CalendarDays },
  { id: "parcours", fr: "Parcours", ht: "Pakou", Icon: Compass },
  { id: "histoire", fr: "Histoire", ht: "Istwa", Icon: BookOpen },
  { id: "nouvelles", fr: "Nouvelles", ht: "Nouvèl", Icon: Newspaper },
] as const;

export type TabId = (typeof TAB_DEFS)[number]["id"];

// ── Props ────────────────────────────────────────────────────────────────────

export interface DashboardTabsProps {
  lang: "fr" | "ht";
  panels: Record<TabId, ReactNode>;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DashboardTabs({ lang, panels }: DashboardTabsProps) {
  const fr = lang === "fr";
  const [activeTab, setActiveTab] = useState<TabId>("bourses");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Track which tabs have been visited — only mount those panels (perf: avoids 5 simultaneous API calls)
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(new Set(["bourses"]));
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  // ── Pill indicator ───────────────────────────────────────────────────────
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  const updatePill = useCallback(() => {
    const tab = tabRefs.current.get(activeTab);
    const container = scrollRef.current;
    if (!tab || !container) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    setPillStyle({
      left: tabRect.left - containerRect.left + container.scrollLeft,
      width: tabRect.width,
    });
    // Scroll active tab into view
    tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeTab]);

  useEffect(() => {
    updatePill();
    window.addEventListener("resize", updatePill);
    return () => window.removeEventListener("resize", updatePill);
  }, [updatePill]);

  // ── Scroll arrows ────────────────────────────────────────────────────────
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkOverflow();
    el.addEventListener("scroll", checkOverflow, { passive: true });
    return () => el.removeEventListener("scroll", checkOverflow);
  }, [checkOverflow]);

  const scrollTabs = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });

  // ── Desktop drag-to-scroll on tab bar ────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    dragStartX.current = e.pageX - el.offsetLeft;
    dragScrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragScrollLeft.current - (x - dragStartX.current);
  };
  const onMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  };

  // ── Tab switch with animation ────────────────────────────────────────────
  const switchTab = useCallback(
    (id: TabId) => {
      if (id === activeTab) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveTab(id);
        setTimeout(() => setIsTransitioning(false), 30);
      }, 150);
    },
    [activeTab],
  );

  // ── Auto-slide timer ─────────────────────────────────────────────────────
  const pausedUntil = useRef(0);
  const AUTOPLAY_MS = 5000; // advance every 5 seconds
  const PAUSE_AFTER_INTERACT_MS = 12000; // pause 12s after manual interaction

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setActiveTab((prev) => {
        const ids = TAB_DEFS.map((t) => t.id);
        const idx = ids.indexOf(prev);
        return ids[(idx + 1) % ids.length];
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, []);

  // Pause auto-slide on user interaction
  const pauseAutoSlide = useCallback(() => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_INTERACT_MS;
  }, []);

  // ── Swipe on content area ────────────────────────────────────────────────
  const handleTouchStart = (e: RTE) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: RTE) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    // Only swipe if horizontal movement > vertical and > 60px
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    const ids = TAB_DEFS.map((t) => t.id);
    const idx = ids.indexOf(activeTab);
    pauseAutoSlide();
    if (dx > 0 && idx < ids.length - 1) switchTab(ids[idx + 1]);
    else if (dx < 0 && idx > 0) switchTab(ids[idx - 1]);
  };

  return (
    <div className="space-y-6">
      {/* ── TAB STRIP ───────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scrollTabs("left")}
            className="absolute -left-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition-all hover:bg-white dark:bg-slate-700/90 dark:hover:bg-slate-700"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-slate-300" />
          </button>
        )}
        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scrollTabs("right")}
            className="absolute -right-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition-all hover:bg-white dark:bg-slate-700/90 dark:hover:bg-slate-700"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="h-4 w-4 text-gray-500 dark:text-slate-300" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="tab-scroll relative flex gap-1 overflow-x-auto rounded-2xl bg-gray-100/80 p-1.5 dark:bg-slate-800/80"
          style={{ cursor: "grab" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Animated pill indicator */}
          <span
            className="absolute top-1.5 z-0 h-[calc(100%-12px)] rounded-xl bg-white shadow-lg ring-1 ring-black/[0.04] transition-all duration-300 ease-out dark:bg-slate-700 dark:ring-white/[0.06]"
            style={{ left: pillStyle.left, width: pillStyle.width }}
          />

          {TAB_DEFS.map((tab) => {
            const isActive = activeTab === tab.id;
            const label = fr ? tab.fr : tab.ht;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                }}
                onClick={() => { pauseAutoSlide(); switchTab(tab.id); }}
                className={[
                  "relative z-10 flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 select-none",
                  isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200",
                ].join(" ")}
              >
                <tab.Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={[
          "transition-all duration-200 ease-out",
          isTransitioning
            ? "translate-y-1 opacity-0"
            : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        {TAB_DEFS.map((tab) => (
          <div
            key={tab.id}
            className={activeTab === tab.id ? "block" : "hidden"}
            role="tabpanel"
            aria-label={fr ? tab.fr : tab.ht}
          >
            {mountedTabs.has(tab.id) ? panels[tab.id] : null}
          </div>
        ))}
      </div>

      {/* ── Swipe hint (mobile) ─────────────────────────────────────────── */}
      <p className="text-center text-[11px] text-gray-400 dark:text-slate-500 sm:hidden">
        {fr ? "← Glisser pour naviguer →" : "← Glise pou navige →"}
      </p>
    </div>
  );
}
