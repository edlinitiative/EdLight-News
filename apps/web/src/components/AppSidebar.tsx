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
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-surface-container-lowest z-40 overflow-y-auto" style={{ borderRight: '1px solid rgba(202,196,208,0.1)' }}>
      <nav className="flex-1 px-3 pt-6">
        <p className="mb-2 px-3 text-label-sm uppercase tracking-[0.15em] text-on-surface-variant/60">Navigation</p>
        <ul className="space-y-0.5">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={withLangParam(href, lang)}
                  className={
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-body-md font-medium transition-all duration-200 " +
                    (active
                      ? "border-l-2 border-l-primary bg-primary/5 text-primary"
                      : "border-l-2 border-l-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface")
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
