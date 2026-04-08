"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Newspaper,
  DollarSign,
  Briefcase,
  Globe,
  GraduationCap,
  CalendarDays,
  Compass,
  BookOpen,
  Award,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { withLangParam } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/news", label: "Actualités", icon: Newspaper },
  { href: "/bourses", label: "Bourses", icon: DollarSign },
  { href: "/opportunites", label: "Opportunités", icon: Briefcase },
  { href: "/haiti", label: "Haïti", icon: Globe },
  { href: "/universites", label: "Universités", icon: GraduationCap },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { href: "/parcours", label: "Parcours", icon: Compass },
  { href: "/histoire", label: "Histoire", icon: BookOpen },
  { href: "/succes", label: "Succès", icon: Award },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar() {
  const pathname = usePathname();
  const { language: lang } = useLanguage();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-[53px] h-screen w-64 bg-white dark:bg-stone-950 border-r border-stone-200 dark:border-stone-800 z-40 overflow-y-auto">
      <div className="px-5 pt-5 pb-4">
        <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 tracking-wide uppercase select-none">
          EdLight News
        </span>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={withLangParam(href, lang)}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors " +
                    (active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
