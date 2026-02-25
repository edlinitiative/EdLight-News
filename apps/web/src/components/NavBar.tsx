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
    <>
      {/* Mobile / tablet top navigation */}
      <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/85 backdrop-blur-2xl dark:border-slate-700/50 dark:bg-slate-950/80 lg:hidden">
        <div className="mx-auto max-w-6xl px-4">
          {/* Top row ── logo + controls */}
          <div className="flex items-center justify-between py-3">
            <Link
              href={"/" + langSuffix}
              className="group inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xl font-extrabold tracking-tight text-brand-600 shadow-sm transition-all hover:border-brand-200 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-brand-400 dark:hover:border-brand-500/30"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-sm dark:bg-brand-500">
                E
              </span>
              <span>
                EdLight<span className="font-light text-gray-400 transition-colors group-hover:text-gray-500 dark:text-slate-500 dark:group-hover:text-slate-400"> News</span>
              </span>
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
                      "relative shrink-0 whitespace-nowrap px-4 py-3 font-medium transition-all duration-200",
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

      {/* Desktop fixed-left sidebar navigation */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 border-r border-gray-200/70 bg-white/92 p-5 backdrop-blur-2xl dark:border-slate-700/60 dark:bg-slate-950/90 lg:flex lg:flex-col">
        <Link
          href={"/" + langSuffix}
          className="group inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-3 py-2 text-xl font-extrabold tracking-tight text-brand-600 shadow-sm transition-all hover:border-brand-200 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-brand-400 dark:hover:border-brand-500/30"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-sm dark:bg-brand-500">
            E
          </span>
          <span>
            EdLight<span className="font-light text-gray-400 transition-colors group-hover:text-gray-500 dark:text-slate-500 dark:group-hover:text-slate-400"> News</span>
          </span>
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <LanguageToggle />
          <DarkModeToggle />
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto pr-1 text-sm" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const label = lang === "ht" ? item.ht : item.fr;
            return (
              <Link
                key={item.href}
                href={item.href + langSuffix}
                aria-current={active ? "page" : undefined}
                className={[
                  "block rounded-xl px-3 py-2.5 font-medium transition-all duration-200",
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Link
          href={"/admin" + langSuffix}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-brand-200 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
        >
          Admin
        </Link>
      </aside>
    </>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function NavBar() {
  return (
    <Suspense
      fallback={
        <>
          <header className="sticky top-0 z-50 h-[96px] border-b border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90 lg:hidden" />
          <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 border-r border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90 lg:block" />
        </>
      }
    >
      <NavBarInner />
    </Suspense>
  );
}
