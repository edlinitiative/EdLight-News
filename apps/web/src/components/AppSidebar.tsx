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
  TrendingUp,
  Lightbulb,
  Cpu,
  Bookmark,
  Feather,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { withLangParam } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/news",         label: { fr: "Actualités",  ht: "Nouvèl"     }, icon: Newspaper     },
  { href: "/haiti",        label: { fr: "Haïti",        ht: "Ayiti"      }, icon: Globe         },
  { href: "/world",        label: { fr: "Monde",        ht: "Mond"       }, icon: TrendingUp    },
  { href: "/education",    label: { fr: "Éducation",    ht: "Edikasyon"  }, icon: GraduationCap },
  { href: "/business",     label: { fr: "Business",     ht: "Biznis"     }, icon: Briefcase     },
  { href: "/technology",   label: { fr: "Techno",       ht: "Teknoloji"  }, icon: Cpu           },
  { href: "/opportunites", label: { fr: "Opportunités", ht: "Okazyon"    }, icon: DollarSign    },
  { href: "/bourses",      label: { fr: "Bourses",      ht: "Bous"       }, icon: DollarSign    },
  { href: "/explainers",   label: { fr: "Explainers",   ht: "Eksplike"   }, icon: Lightbulb     },
  { href: "/opinion",      label: { fr: "Opinion",      ht: "Opinyon"    }, icon: Feather       },
  { href: "/histoire",     label: { fr: "Histoire",     ht: "Istwa"      }, icon: BookOpen      },
  { href: "/universites",  label: { fr: "Universités",  ht: "Inivèsite"  }, icon: GraduationCap },
  { href: "/calendrier",   label: { fr: "Calendrier",   ht: "Kalandriye" }, icon: CalendarDays  },
  { href: "/parcours",     label: { fr: "Parcours",     ht: "Wout"       }, icon: Compass       },
  { href: "/succes",       label: { fr: "Succès",       ht: "Siksè"      }, icon: Award         },
  { href: "/saved",        label: { fr: "Sauvegardés",  ht: "Sove"       }, icon: Bookmark      },
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
        <Link
          href={withLangParam("/", lang)}
          className="text-xs font-semibold text-stone-400 dark:text-stone-500 tracking-wide uppercase hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
        >
          EdLight News
        </Link>
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
                  {label[lang]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
