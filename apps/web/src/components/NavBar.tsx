"use client";

import { Suspense, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { DarkModeToggle } from "@/components/DarkModeToggle";

// ── Tab definitions ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/",                fr: "Accueil",       ht: "Akèy"         },
  { href: "/opportunites",    fr: "Opportunités",  ht: "Okazyon"      },
  { href: "/bourses",         fr: "Bourses",       ht: "Bous"         },
  { href: "/universites",     fr: "Universités",   ht: "Inivèsite"   },
  { href: "/parcours",        fr: "Parcours",      ht: "Pakou"        },
  { href: "/calendrier",      fr: "Calendrier",    ht: "Kalandriye"   },
  { href: "/histoire",        fr: "Histoire",      ht: "Istwa"        },
  { href: "/haiti",           fr: "Haïti",         ht: "Ayiti"        },
  { href: "/ressources",      fr: "Ressources",    ht: "Resous"       },
  { href: "/succes",          fr: "Succès",        ht: "Siksè"        },
  { href: "/news",            fr: "Fil",           ht: "Fil"          },
] as const;

// ── Inner component (needs useSearchParams → must be inside Suspense) ────────

function NavBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = (searchParams.get("lang") ?? "fr") as "fr" | "ht";
  const langSuffix = lang === "ht" ? "?lang=ht" : "";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Animated underline
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

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

  // Position underline on active tab
  useEffect(() => {
    const activeHref = NAV_ITEMS.find((item) => isActive(item.href))?.href;
    if (!activeHref) return;
    const tab = tabRefs.current.get(activeHref);
    const container = scrollRef.current;
    if (!tab || !container) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    setUnderlineStyle({
      left: tabRect.left - containerRect.left + container.scrollLeft,
      width: tabRect.width,
    });

    // Scroll active tab into view
    tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -180 : 180, behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90">
      <div className="mx-auto max-w-6xl px-4">
        {/* Top row ── logo + controls */}
        <div className="flex items-center justify-between py-3">
          <Link
            href={"/" + langSuffix}
            className="text-xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400"
          >
            EdLight<span className="font-light text-gray-400 dark:text-slate-500"> News</span>
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

        {/* Tab row ── premium sliding tab bar */}
        <div className="relative">
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
            className="tab-scroll relative flex overflow-x-auto text-sm"
            aria-label="Navigation principale"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const label = lang === "ht" ? item.ht : item.fr;
              return (
                <Link
                  key={item.href}
                  href={item.href + langSuffix}
                  ref={(el) => {
                    if (el) tabRefs.current.set(item.href, el);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "shrink-0 whitespace-nowrap px-4 py-3 font-medium transition-all duration-200",
                    active
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}

            {/* Animated underline indicator */}
            <span
              className="absolute bottom-0 h-[2.5px] rounded-full bg-brand-500 transition-all duration-300 ease-out dark:bg-brand-400"
              style={{
                left: underlineStyle.left,
                width: underlineStyle.width,
              }}
            />
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
