"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, Search } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/language-context";
import { withLangParam } from "@/lib/utils";

interface NavLink {
  href: string;
  label: { fr: string; ht: string };
  section?: "primary" | "secondary";
}

// Primary nav mirrors PRD §8 Top-Level Navigation
const NAV_LINKS: NavLink[] = [
  { href: "/news",        label: { fr: "Actualités",        ht: "Nouvèl"      }, section: "primary" },
  { href: "/opportunites",label: { fr: "Opportunités",      ht: "Okazyon"     }, section: "primary" },
  { href: "/haiti",       label: { fr: "Haïti",             ht: "Ayiti"       }, section: "primary" },
  { href: "/world",       label: { fr: "Monde",             ht: "Mond"        }, section: "primary" },
  { href: "/education",   label: { fr: "Éducation",         ht: "Edikasyon"   }, section: "primary" },
  { href: "/business",    label: { fr: "Business",          ht: "Biznis"      }, section: "primary" },
  { href: "/technology",  label: { fr: "Techno",            ht: "Teknoloji"   }, section: "primary" },
  { href: "/opinion",    label: { fr: "Opinion",           ht: "Opinyon"     }, section: "secondary" },
  { href: "/explainers",  label: { fr: "Explainers",        ht: "Eksplike"    }, section: "secondary" },
  { href: "/bourses",     label: { fr: "Bourses",           ht: "Bous"        }, section: "secondary" },
  { href: "/about",       label: { fr: "À propos",          ht: "Sou nou"     }, section: "secondary" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fr = language === "fr";

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(withLangParam(`/search?q=${encodeURIComponent(searchQuery.trim())}`, language));
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const panel = mobilePanelRef.current;
    if (!panel) return;

    const focusable = () =>
      panel.querySelectorAll<HTMLElement>(
        'a[href], button, input, [tabindex]:not([tabindex="-1"])'
      );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      if (!els.length) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const els = focusable();
    if (els.length) els[0]!.focus();

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const id = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [searchOpen]);

  const allLinks = NAV_LINKS;
  const primaryLinks = NAV_LINKS.filter((l) => l.section === "primary");
  const secondaryLinks = NAV_LINKS.filter((l) => l.section === "secondary");
  const l = (href: string) => withLangParam(href, language);

  return (
    <>
      {/* ── Search overlay ────────────────────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-20 px-4" onClick={() => setSearchOpen(false)}>
          <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white shadow-2xl ring-1 ring-black/5 dark:border-stone-700 dark:bg-stone-900 dark:ring-white/5 p-4">
              <Search className="h-5 w-5 shrink-0 text-stone-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={fr ? "Rechercher des articles, opportunités…" : "Chèche atik, okazyon…"}
                className="flex-1 bg-transparent text-base text-stone-900 placeholder-stone-400 outline-none dark:text-white"
                autoFocus
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="text-stone-400 hover:text-stone-600">
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {fr ? "Chercher" : "Chèche"}
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-stone-400">
              {fr ? "Appuyez sur Échap pour fermer" : "Peze Esc pou fèmen"}
            </p>
          </div>
        </div>
      )}

      {/* ── Single sticky header ──────────────────────────────────── */}
      <header
        ref={navRef}
        className="sticky top-0 z-50 border-b border-stone-200/50 bg-white/85 backdrop-blur-xl shadow-[0_1px_0_0_rgb(0,0,0,0.03)] dark:border-stone-800/40 dark:bg-stone-950/90 dark:shadow-none"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          {/* Brand — Home link */}
          <Link href={l("/")} className="flex shrink-0 items-baseline gap-0 mr-1">
            <span className="text-lg font-black tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
              EdLight
            </span>
            <span className="ml-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
              News
            </span>
          </Link>

          {/* Desktop nav — primary links prominent, secondary links muted */}
          <nav className="hidden flex-1 items-center overflow-x-auto tab-scroll lg:flex">
            {/* Primary */}
            <div className="flex items-center gap-0.5">
              {primaryLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={l(link.href)}
                    className={[
                      "relative whitespace-nowrap px-3 py-2 text-[13px] font-semibold transition-all duration-200",
                      active
                        ? "text-stone-900 dark:text-white"
                        : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200",
                    ].join(" ")}
                  >
                    {link.label[language]}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-400" />
                    )}
                  </Link>
                );
              })}
            </div>
            {/* Divider */}
            <div className="mx-2 h-4 w-px bg-stone-200 dark:bg-stone-700" />
            {/* Secondary */}
            <div className="flex items-center gap-0.5">
              {secondaryLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={l(link.href)}
                    className={[
                      "relative whitespace-nowrap px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      active
                        ? "text-stone-700 dark:text-stone-200"
                        : "text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300",
                    ].join(" ")}
                  >
                    {link.label[language]}
                    {active && (
                      <span className="absolute bottom-0 left-2.5 right-2.5 h-0.5 rounded-full bg-stone-400 dark:bg-stone-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-1">
            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              aria-label={fr ? "Rechercher" : "Chèche"}
              title={fr ? "Rechercher (⌘K)" : "Chèche (⌘K)"}
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            <LanguageToggle />
            <DarkModeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 lg:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={mobilePanelRef}
            className="absolute inset-y-0 right-0 top-14 w-72 overflow-y-auto border-l border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-950"
            role="dialog"
            aria-modal="true"
            aria-label={fr ? "Menu de navigation" : "Meni navigasyon"}
          >
            {/* Mobile search bar */}
            <div className="border-b border-stone-100 p-3 dark:border-stone-800">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-700 dark:bg-stone-900">
                <Search className="h-4 w-4 shrink-0 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={fr ? "Rechercher…" : "Chèche…"}
                  className="flex-1 bg-transparent text-sm text-stone-900 placeholder-stone-400 outline-none dark:text-white"
                />
              </form>
            </div>

            <div className="p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                {fr ? "Navigation" : "Navigasyon"}
              </p>
              {/* Home link */}
              <Link
                href={l("/")}
                onClick={() => setMobileOpen(false)}
                className={[
                  "flex rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                  pathname === "/"
                    ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white",
                ].join(" ")}
              >
                {fr ? "Accueil" : "Akèy"}
              </Link>
              <nav className="mt-1 flex flex-col">
                {primaryLinks.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={l(link.href)}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white"
                          : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white",
                      ].join(" ")}
                    >
                      {link.label[language]}
                    </Link>
                  );
                })}
              </nav>

              <div className="my-3 border-t border-stone-100 dark:border-stone-800" />

              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                {fr ? "Plus" : "Plis"}
              </p>
              <nav className="flex flex-col">
                {secondaryLinks.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={l(link.href)}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white"
                          : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white",
                      ].join(" ")}
                    >
                      {link.label[language]}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
