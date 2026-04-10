"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { withLangParam } from "@/lib/utils";
import { Instagram, ExternalLink } from "lucide-react";

const T = {
  tagline: {
    fr: "La plateforme d'information et d'opportunités pour les jeunes haïtiens et la diaspora.",
    ht: "Platfòm enfòmasyon ak okazyon pou jèn ayisyen yo ak dyaspora a.",
  },
  edition: {
    fr: "Édition quotidienne",
    ht: "Edisyon chak jou",
  },
  headingCoverage: { fr: "Couverture", ht: "Kouvèti" },
  headingOpportunities: { fr: "Opportunités", ht: "Okazyon" },
  headingCompany: { fr: "EdLight News", ht: "EdLight News" },
  about: {
    fr: "EdLight News publie des actualités, explainers et opportunités vérifiées pour les étudiants haïtiens et la diaspora.",
    ht: "EdLight News pibliye nouvèl, eksplikasyon ak okazyon verifye pou elèv ayisyen yo ak dyaspora a.",
  },
  disclaimer: {
    fr: "Les informations ne constituent pas un conseil officiel.",
    ht: "Enfòmasyon yo pa konstitye yon konsèy ofisyèl.",
  },
  coverageLinks: {
    fr: [
      { href: "/news",       label: "Actualités"       },
      { href: "/haiti",      label: "Haïti"            },
      { href: "/world",      label: "Monde"            },
      { href: "/education",  label: "Éducation"        },
      { href: "/business",   label: "Business"         },
      { href: "/technology", label: "Technologie"      },
      { href: "/explainers", label: "Explainers"       },
    ],
    ht: [
      { href: "/news",       label: "Nouvèl"           },
      { href: "/haiti",      label: "Ayiti"            },
      { href: "/world",      label: "Mond"             },
      { href: "/education",  label: "Edikasyon"        },
      { href: "/business",   label: "Biznis"           },
      { href: "/technology", label: "Teknoloji"        },
      { href: "/explainers", label: "Eksplike"         },
    ],
  },
  opportunityLinks: {
    fr: [
      { href: "/opportunites", label: "Opportunités"   },
      { href: "/bourses",      label: "Bourses"        },
      { href: "/closing-soon", label: "Ferme bientôt" },
      { href: "/ressources",   label: "Ressources"     },
      { href: "/calendrier",   label: "Calendrier"     },
    ],
    ht: [
      { href: "/opportunites", label: "Okazyon"        },
      { href: "/bourses",      label: "Bous"           },
      { href: "/closing-soon", label: "Fèmen byento"   },
      { href: "/ressources",   label: "Resous"         },
      { href: "/calendrier",   label: "Kalandriye"     },
    ],
  },
  companyLinks: {
    fr: [
      { href: "/about",                label: "À propos"             },
      { href: "/editorial-standards",  label: "Standards éditoriaux" },
      { href: "/contact",              label: "Contact"              },
      { href: "/contact?partner=1",    label: "Partenariats"         },
      { href: "/privacy",              label: "Confidentialité"      },
      { href: "/terms",                label: "Conditions"           },
    ],
    ht: [
      { href: "/about",                label: "Sou nou"              },
      { href: "/editorial-standards",  label: "Estanda editoryal"    },
      { href: "/contact",              label: "Kontakt"              },
      { href: "/contact?partner=1",    label: "Patnenarya"           },
      { href: "/privacy",              label: "Konfidyansyalite"     },
      { href: "/terms",                label: "Kondisyon"            },
    ],
  },
} as const;

export function Footer() {
  const { language: lang } = useLanguage();
  const l = (href: string) => withLangParam(href, lang);

  return (
    <footer className="border-t-2 border-stone-300 bg-stone-950 dark:border-stone-700 dark:bg-stone-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Masthead in footer */}
        <div className="mb-10 border-b border-stone-800 pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold tracking-tight text-white">EdLight</span>
                <span className="text-xl font-normal tracking-tight text-stone-400">News</span>
              </div>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-400">
                {T.tagline[lang]}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              {/* Instagram social link */}
              <a
                href="https://www.instagram.com/edlightnews"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-stone-700 px-4 py-2 text-sm font-medium text-stone-300 transition-colors hover:border-stone-500 hover:text-white"
              >
                <Instagram className="h-4 w-4" />
                @edlightnews
              </a>
              {/* EdLight main site */}
              <a
                href="https://edlight.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-stone-500 transition-colors hover:text-stone-300"
              >
                <ExternalLink className="h-3 w-3" />
                {lang === "fr" ? "Site EdLight principal" : "Sit prensipal EdLight"}
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="max-w-xs text-sm leading-relaxed text-stone-400">
              {T.about[lang]}
            </p>
          </div>

          {/* Coverage sections */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
              {T.headingCoverage[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              {T.coverageLinks[lang].map((link) => (
                <Link
                  key={link.href}
                  href={l(link.href)}
                  className="footer-link w-fit text-stone-400 transition-colors hover:text-stone-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Opportunities */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
              {T.headingOpportunities[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              {T.opportunityLinks[lang].map((link) => (
                <Link
                  key={link.href}
                  href={l(link.href)}
                  className="footer-link w-fit text-stone-400 transition-colors hover:text-stone-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
              {T.headingCompany[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              {T.companyLinks[lang].map((link) => (
                <Link
                  key={link.href}
                  href={l(link.href)}
                  className="footer-link w-fit text-stone-400 transition-colors hover:text-stone-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-stone-800 pt-6">
          <p className="text-xs text-stone-500">
            © {new Date().getFullYear()} EdLight Initiative
          </p>
          <p className="text-xs text-stone-600">
            {T.disclaimer[lang]}
          </p>
        </div>
      </div>
    </footer>
  );
}

