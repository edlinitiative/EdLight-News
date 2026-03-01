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
  { id: "bourses", fr: "Bourses", ht: "Bous", Icon: DollarSign },
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
    // Horizontally center the active tab *inside* the tab strip only —
    // never call scrollIntoView() here because it scrolls the whole page
    // on mobile when the dashboard section is below the fold.
    const targetScrollLeft =
      tabRect.left -
      containerRect.left +
      container.scrollLeft -
      (containerRect.width - tabRect.width) / 2;
    container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
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

  const onKeyDownTab = (e: React.KeyboardEvent<HTMLButtonElement>, currentId: TabId) => {
    const ids = TAB_DEFS.map((t) => t.id);
    const idx = ids.indexOf(currentId);
    if (idx < 0) return;
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % ids.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = ids.length - 1;
    else return;
    e.preventDefault();
    switchTab(ids[nextIdx]);
    tabRefs.current.get(ids[nextIdx])?.focus();
  };

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
    if (dx > 0 && idx < ids.length - 1) switchTab(ids[idx + 1]);
    else if (dx < 0 && idx > 0) switchTab(ids[idx - 1]);
  };

  return (
    <div className="space-y-4">

      {/* ── TAB STRIP ───────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scrollTabs("left")}
            className="absolute -left-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-stone-400 shadow-sm ring-1 ring-stone-200 transition-all hover:text-stone-900 dark:bg-stone-800 dark:text-stone-500 dark:ring-stone-700 dark:hover:text-white"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scrollTabs("right")}
            className="absolute -right-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-stone-400 shadow-sm ring-1 ring-stone-200 transition-all hover:text-stone-900 dark:bg-stone-800 dark:text-stone-500 dark:ring-stone-700 dark:hover:text-white"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="tab-scroll relative flex gap-0.5 overflow-x-auto border-b border-stone-200 pb-px dark:border-stone-800"
          style={{ cursor: "grab" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          role="tablist"
          aria-label={fr ? "Sections du tableau de bord" : "Seksyon tablo a"}
        >
          {TAB_DEFS.map((tab) => {
            const isActive = activeTab === tab.id;
            const label = fr ? tab.fr : tab.ht;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                }}
                onClick={() => switchTab(tab.id)}
                onKeyDown={(e) => onKeyDownTab(e, tab.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`dashboard-panel-${tab.id}`}
                id={`dashboard-tab-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={[
                  "relative z-10 flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 select-none",
                  isActive
                    ? "border-stone-900 text-stone-900 dark:border-white dark:text-white"
                    : "border-transparent text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300",
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
          "relative overflow-hidden rounded-xl border border-stone-200 bg-white p-3 transition-all duration-200 ease-out dark:border-stone-800 dark:bg-stone-900 sm:p-4",
          isTransitioning
            ? "translate-y-1 opacity-0"
            : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        {TAB_DEFS.map((tab) => (
          <div
            key={tab.id}
            className={activeTab === tab.id ? "relative block" : "hidden"}
            role="tabpanel"
            aria-labelledby={`dashboard-tab-${tab.id}`}
            id={`dashboard-panel-${tab.id}`}
          >
            {mountedTabs.has(tab.id) ? panels[tab.id] : null}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-0.5">
        {TAB_DEFS.map((tab) => (
          <button
            key={`${tab.id}-dot`}
            type="button"
            onClick={() => switchTab(tab.id)}
            aria-label={fr ? `Aller à ${tab.fr}` : `Ale nan ${tab.ht}`}
            className="flex h-9 w-9 items-center justify-center"
          >
            <span
              className={[
                "h-1.5 rounded-full transition-all",
                activeTab === tab.id
                  ? "w-5 bg-stone-900 dark:bg-white"
                  : "w-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600",
              ].join(" ")}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
