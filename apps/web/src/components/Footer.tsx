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
    <footer className="relative bg-[#141211]">
      {/* Decorative top gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-silk" />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Masthead in footer */}
        <div className="mb-12 pb-10" style={{ borderBottom: '1px solid rgba(202,196,208,0.1)' }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-0">
                <span className="text-lg font-extrabold tracking-[-0.02em] text-[#e7e1de]" style={{ fontFamily: "var(--font-display, var(--font-sans))" }}>
                  EdLight <span className="font-semibold text-[#c4bcff]">News</span>
                </span>
              </div>
              <p className="mt-2 max-w-sm text-body-md leading-relaxed text-[#948f8c]">
                {T.tagline[lang]}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              {/* Instagram social link */}
              <a
                href="https://www.instagram.com/edlightnews"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-body-md font-medium text-[#cac4c0] transition-colors hover:text-[#e7e1de]"
                style={{ border: '1px solid rgba(202,196,208,0.15)' }}
              >
                <Instagram className="h-4 w-4" />
                @edlightnews
              </a>
              {/* EdLight main site */}
              <a
                href="https://edlight.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-label-sm text-[#78716c] transition-colors hover:text-[#cac4c0]"
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
            <p className="max-w-xs text-body-md leading-relaxed text-[#948f8c]">
              {T.about[lang]}
            </p>
          </div>

          {/* Coverage sections */}
          <div>
            <h3 className="text-label-sm font-bold uppercase tracking-[0.2em] text-[#948f8c]">
              {T.headingCoverage[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-body-md">
              {T.coverageLinks[lang].map((link) => (
                <Link
                  key={link.href}
                  href={l(link.href)}
                  className="footer-link w-fit text-[#78716c] transition-colors hover:text-[#e7e1de]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Opportunities */}
          <div>
            <h3 className="text-label-sm font-bold uppercase tracking-[0.2em] text-[#948f8c]">
              {T.headingOpportunities[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-body-md">
              {T.opportunityLinks[lang].map((link) => (
                <Link
                  key={link.href}
                  href={l(link.href)}
                  className="footer-link w-fit text-[#78716c] transition-colors hover:text-[#e7e1de]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-label-sm font-bold uppercase tracking-[0.2em] text-[#948f8c]">
              {T.headingCompany[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-body-md">
              {T.companyLinks[lang].map((link) => (
                <Link
                  key={link.href}
                  href={l(link.href)}
                  className="footer-link w-fit text-[#78716c] transition-colors hover:text-[#e7e1de]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 pt-8" style={{ borderTop: '1px solid rgba(202,196,208,0.1)' }}>
          <div className="flex flex-col gap-1">
            <p className="text-label-sm text-[#78716c]">
              © {new Date().getFullYear()} EdLight Initiative
            </p>
            <a
              href="https://edlight.org/labs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-label-sm text-[#78716c] transition-colors hover:text-[#c4bcff]"
            >
              {lang === "fr" ? "Créé avec" : "Kreye ak"}{" "}
              <span className="font-semibold">EdLight Labs</span>
            </a>
          </div>
          <p className="text-label-sm text-[#49454f]">
            {T.disclaimer[lang]}
          </p>
        </div>
      </div>
    </footer>
  );
}

