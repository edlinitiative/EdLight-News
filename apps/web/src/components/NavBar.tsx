"use client";

import { Suspense, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageToggle } from "@/components/language-toggle";
import { DarkModeToggle } from "@/components/DarkModeToggle";

// ── Tab definitions ──────────────────────────────────────────────────────────

/** Primary tabs — always visible */
const PRIMARY_ITEMS = [
  { href: "/",             fr: "Accueil",       ht: "Akèy"       },
  { href: "/opportunites", fr: "Opportunités",  ht: "Okazyon"    },
  { href: "/bourses",      fr: "Bourses",       ht: "Bous"       },
  { href: "/universites",  fr: "Universités",   ht: "Inivèsite"  },
  { href: "/parcours",     fr: "Parcours",      ht: "Pakou"      },
] as const;

/** Secondary tabs — collapsed into "Plus" on desktop */
const MORE_ITEMS = [
  { href: "/calendrier", fr: "Calendrier", ht: "Kalandriye" },
  { href: "/histoire",   fr: "Histoire",   ht: "Istwa"      },
  { href: "/haiti",      fr: "Haïti",      ht: "Ayiti"      },
  { href: "/ressources", fr: "Ressources", ht: "Resous"     },
  { href: "/succes",     fr: "Succès",     ht: "Siksè"      },
  { href: "/news",       fr: "Fil",        ht: "Fil"        },
] as const;

const ALL_ITEMS = [...PRIMARY_ITEMS, ...MORE_ITEMS];

// ── Inner component (needs useSearchParams → must be inside Suspense) ────────

function NavBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = (searchParams.get("lang") ?? "fr") as "fr" | "ht";
  const langSuffix = lang === "ht" ? "?lang=ht" : "";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  // Is the active page inside the "More" menu?
  const activeMoreItem = MORE_ITEMS.find((item) => isActive(item.href));

  // Close dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [moreOpen]);

  // Close on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Check scroll overflow
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
    window.addEventListener("resize", checkOverflow);
    return () => {
      el.removeEventListener("scroll", checkOverflow);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [checkOverflow]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -180 : 180, behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/85 backdrop-blur-2xl dark:border-slate-700/50 dark:bg-slate-950/80">
      <div className="mx-auto max-w-6xl px-4">
        {/* Top row ── logo + controls */}
        <div className="flex items-center justify-between py-3">
          <Link
            href={"/" + langSuffix}
            className="group inline-flex items-center gap-1.5 px-1 py-1.5 text-xl tracking-tight transition-opacity hover:opacity-80"
          >
            <span className="font-serif font-bold text-brand-700 dark:text-brand-300">Ed</span>
            <span className="font-light text-gray-400 dark:text-slate-500">Light</span>
            <span className="text-sm font-medium text-gray-400 dark:text-slate-500">News</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={"/admin" + langSuffix}
              className="hidden text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 sm:block"
            >
              Admin
            </Link>
            <LanguageToggle />
            <DarkModeToggle />
          </div>
        </div>

        {/* Tab row */}
        <div className="relative rounded-2xl border border-gray-200/70 bg-white/60 px-1 dark:border-slate-700/60 dark:bg-slate-900/60">
          {/* Left fade + arrow */}
          {canScrollLeft && (
            <>
              <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-10 bg-gradient-to-r from-white dark:from-slate-900" />
              <button
                onClick={() => scroll("left")}
                className="absolute bottom-0 left-0 top-0 z-20 flex w-8 items-center justify-center text-gray-400 transition-colors hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400"
                aria-label="Scroll tabs left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Right fade + arrow */}
          {canScrollRight && (
            <>
              <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-10 bg-gradient-to-l from-white dark:from-slate-900" />
              <button
                onClick={() => scroll("right")}
                className="absolute bottom-0 right-0 top-0 z-20 flex w-8 items-center justify-center text-gray-400 transition-colors hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400"
                aria-label="Scroll tabs right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          <nav
            ref={scrollRef}
            className="tab-scroll relative flex items-center overflow-x-auto text-sm"
            aria-label="Navigation principale"
          >
            {PRIMARY_ITEMS.map((item) => {
              const active = isActive(item.href);
              const label = lang === "ht" ? item.ht : item.fr;
              return (
                <Link
                  key={item.href}
                  href={item.href + langSuffix}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative shrink-0 whitespace-nowrap px-4 py-3 font-medium transition-colors duration-200",
                    active
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200",
                  ].join(" ")}
                >
                  {label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-1 -bottom-px h-[2.5px] rounded-full bg-brand-500 dark:bg-brand-400"
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    />
                  )}
                </Link>
              );
            })}

            {/* "Plus" dropdown trigger */}
            <div ref={moreRef} className="relative shrink-0">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={[
                  "flex items-center gap-1 whitespace-nowrap px-4 py-3 font-medium transition-colors duration-200",
                  activeMoreItem
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200",
                ].join(" ")}
              >
                {activeMoreItem
                  ? (lang === "ht" ? activeMoreItem.ht : activeMoreItem.fr)
                  : (lang === "ht" ? "Plis" : "Plus")}
                <ChevronDown className={[
                  "h-3.5 w-3.5 transition-transform duration-200",
                  moreOpen ? "rotate-180" : "",
                ].join(" ")} />
                {activeMoreItem && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-1 -bottom-px h-[2.5px] rounded-full bg-brand-500 dark:bg-brand-400"
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
              </button>

              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-gray-200/80 bg-white p-1 shadow-lg dark:border-slate-700/60 dark:bg-slate-900"
                  >
                    {MORE_ITEMS.map((item) => {
                      const active = isActive(item.href);
                      const label = lang === "ht" ? item.ht : item.fr;
                      return (
                        <Link
                          key={item.href}
                          href={item.href + langSuffix}
                          className={[
                            "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                              : "text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800",
                          ].join(" ")}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function NavBar() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-50 h-[96px] border-b border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90" />
      }
    >
      <NavBarInner />
    </Suspense>
  );
}
