"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/language-context";

interface NavLink {
  href: string;
  label: { fr: string; ht: string };
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: { fr: "Accueil", ht: "Akèy" } },
  { href: "/bourses", label: { fr: "Bourses", ht: "Bous" } },
  { href: "/opportunites", label: { fr: "Opportunités", ht: "Okazyon" } },
  { href: "/universites", label: { fr: "Universités", ht: "Inivèsite" } },
  { href: "/calendrier", label: { fr: "Calendrier", ht: "Kalandriye" } },
  { href: "/parcours", label: { fr: "Parcours", ht: "Pakou" } },
  { href: "/haiti", label: { fr: "Haïti", ht: "Ayiti" } },
  { href: "/histoire", label: { fr: "Histoire", ht: "Istwa" } },
  { href: "/news", label: { fr: "Fil", ht: "Fil" } },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavBar() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <nav
        ref={navRef}
        className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/90"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-baseline gap-0.5">
            <span className="font-serif text-lg font-bold text-stone-900 dark:text-white">Ed</span>
            <span className="text-lg font-light text-stone-400 dark:text-stone-500">Light</span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden flex-1 items-center gap-0.5 overflow-x-auto tab-scroll lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "relative whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white"
                      : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white",
                  ].join(" ")}
                >
                  {link.label[language]}
                </Link>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <LanguageToggle />
            <DarkModeToggle />

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 lg:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 top-14 w-72 border-l border-stone-200 bg-white p-5 shadow-float dark:border-stone-800 dark:bg-stone-950">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
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
      )}
    </>
  );
}
