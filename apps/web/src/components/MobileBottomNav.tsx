"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Newspaper, Globe, DollarSign, Bookmark, Search } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { withLangParam } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/",
    icon: Home,
    label: { fr: "Accueil", ht: "Akèy" },
  },
  {
    href: "/news",
    icon: Newspaper,
    label: { fr: "Actualités", ht: "Nouvèl" },
  },
  {
    href: "/haiti",
    icon: Globe,
    label: { fr: "Haïti", ht: "Ayiti" },
  },
  {
    href: "/bourses",
    icon: DollarSign,
    label: { fr: "Bourses", ht: "Bous" },
  },
  {
    href: "/saved",
    icon: Bookmark,
    label: { fr: "Favoris", ht: "Favori" },
  },
  {
    href: "/search",
    icon: Search,
    label: { fr: "Chercher", ht: "Chèche" },
  },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { language: lang } = useLanguage();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 dark:bg-stone-950/90 backdrop-blur-xl border-t border-stone-200/80 dark:border-stone-800/80 px-2 pb-4 flex justify-around items-center h-16">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={withLangParam(href, lang)}
            className={`flex flex-col items-center gap-0.5 transition-colors duration-200 ${
              active
                ? "text-blue-600 dark:text-blue-400"
                : "text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-tight">
              {lang === "ht" ? label.ht : label.fr}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
