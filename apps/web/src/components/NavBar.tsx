"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, TrendingUp } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/language-context";

interface NavLink {
  href: string;
  label: { fr: string; ht: string };
  section?: "primary" | "secondary";
}

const NAV_LINKS: NavLink[] = [
  { href: "/news", label: { fr: "Actualités", ht: "Nouvèl" }, section: "primary" },
  { href: "/bourses", label: { fr: "Bourses", ht: "Bous" }, section: "primary" },
  { href: "/opportunites", label: { fr: "Opportunités", ht: "Okazyon" }, section: "primary" },
  { href: "/haiti", label: { fr: "Haïti", ht: "Ayiti" }, section: "primary" },
  { href: "/universites", label: { fr: "Universités", ht: "Inivèsite" }, section: "secondary" },
  { href: "/calendrier", label: { fr: "Calendrier", ht: "Kalandriye" }, section: "secondary" },
  { href: "/parcours", label: { fr: "Parcours", ht: "Pakou" }, section: "secondary" },
  { href: "/histoire", label: { fr: "Histoire", ht: "Istwa" }, section: "secondary" },
  { href: "/succes", label: { fr: "Succès", ht: "Siksè" }, section: "secondary" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function formatDate(lang: "fr" | "ht"): string {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return now.toLocaleDateString(lang === "fr" ? "fr-FR" : "fr-HT", opts);
}

export function NavBar() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const fr = language === "fr";

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const primaryLinks = NAV_LINKS.filter((l) => l.section === "primary");
  const secondaryLinks = NAV_LINKS.filter((l) => l.section === "secondary");

  return (
    <>
      {/* ── Top edition bar ────────────────────────────────────────────── */}
      <div className="hidden border-b border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950 sm:block">
        <div className="mx-auto flex h-8 max-w-6xl items-center justify-between px-4 text-[11px] sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
              {fr ? "Édition quotidienne" : "Edisyon chak jou"}
            </span>
            <span className="text-stone-300 dark:text-stone-700">|</span>
            <time className="capitalize text-stone-500 dark:text-stone-400" suppressHydrationWarning>
              {formatDate(language)}
            </time>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              <span className="hidden sm:inline">{fr ? "Pour étudiants haïtiens" : "Pou elèv ayisyen yo"}</span>
            </span>
            <div className="flex items-center gap-1">
              <LanguageToggle />
              <DarkModeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* ── Masthead ───────────────────────────────────────────────────── */}
      <div className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/" className="group flex items-baseline gap-1">
            <span className="font-serif text-2xl font-black tracking-tight text-stone-900 transition-colors group-hover:text-blue-600 dark:text-white sm:text-3xl">
              EdLight
            </span>
            <span className="font-serif text-2xl font-light tracking-tight text-blue-600 dark:text-blue-400 sm:text-3xl">
              News
            </span>
          </Link>

          {/* Mobile controls */}
          <div className="flex items-center gap-1 sm:hidden">
            <LanguageToggle />
            <DarkModeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Desktop tagline */}
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                {fr ? "Actualités éducatives" : "Nouvèl edikasyon"}
              </p>
              <p className="text-[11px] text-stone-400 dark:text-stone-600">
                {fr ? "Bourses · Opportunités · Carrières" : "Bous · Okazyon · Karyè"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main navigation ────────────────────────────────────────────── */}
      <nav
        ref={navRef}
        className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/95"
      >
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-0 px-4 sm:px-6 lg:px-8">
          {/* Primary sections */}
          <div className="hidden flex-1 items-center gap-0 overflow-x-auto tab-scroll lg:flex">
            {primaryLinks.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "nav-link relative whitespace-nowrap px-3.5 py-2.5 text-[13px] font-semibold uppercase tracking-wide transition-colors",
                    active
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white",
                  ].join(" ")}
                >
                  {link.label[language]}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] bg-blue-600 dark:bg-blue-400" />
                  )}
                </Link>
              );
            })}

            {/* Divider */}
            <span className="mx-1.5 h-4 w-px bg-stone-200 dark:bg-stone-700" />

            {/* Secondary sections */}
            {secondaryLinks.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "nav-link relative whitespace-nowrap px-2.5 py-2.5 text-[12px] font-medium transition-colors",
                    active
                      ? "text-stone-900 dark:text-white"
                      : "text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300",
                  ].join(" ")}
                >
                  {link.label[language]}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] bg-stone-900 dark:bg-white" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Home link (desktop) */}
          <Link
            href="/"
            className={[
              "hidden text-[12px] font-medium transition-colors lg:block",
              pathname === "/"
                ? "text-blue-600 dark:text-blue-400"
                : "text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300",
            ].join(" ")}
          >
            {fr ? "Accueil" : "Akèy"}
          </Link>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 top-[108px] w-80 border-l border-stone-200 bg-white shadow-float dark:border-stone-800 dark:bg-stone-950">
            <div className="p-5">
              {/* Primary nav */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                {fr ? "Rubriques" : "Ribrik"}
              </p>
              <nav className="mb-5 flex flex-col gap-0.5">
                {primaryLinks.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        "rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                          : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white",
                      ].join(" ")}
                    >
                      {link.label[language]}
                    </Link>
                  );
                })}
              </nav>

              <div className="mb-5 border-t border-stone-100 dark:border-stone-800" />

              {/* Secondary nav */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                {fr ? "Explorer" : "Eksplore"}
              </p>
              <nav className="mb-5 flex flex-col gap-0.5">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    pathname === "/"
                      ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white"
                      : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white",
                  ].join(" ")}
                >
                  {fr ? "Accueil" : "Akèy"}
                </Link>
                {secondaryLinks.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
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

              {/* Edition line in mobile */}
              <div className="rounded-lg bg-stone-50 p-3 dark:bg-stone-900">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  {fr ? "Édition" : "Edisyon"}
                </p>
                <p className="mt-1 text-xs capitalize text-stone-500 dark:text-stone-400" suppressHydrationWarning>
                  {formatDate(language)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
