"use client";

import { useLanguage } from "@/lib/language-context";

const T = {
  tagline: {
    fr: "Conçu pour les étudiants haïtiens — Nouvelles, bourses et ressources vérifiées.",
    ht: "Fèt pou elèv ayisyen yo — Nouvèl, bous ak resous verifye.",
  },
  edition: {
    fr: "Édition quotidienne",
    ht: "Edisyon chak jou",
  },
  headingRubriques: { fr: "Rubriques", ht: "Ribrik" },
  headingExplore: { fr: "Explorer", ht: "Eksplore" },
  headingAbout: { fr: "À propos", ht: "Sou nou" },
  about: {
    fr: "EdLight News synthétise des sources publiques pour informer les étudiants.",
    ht: "EdLight News rezime sous piblik pou enfòme elèv yo.",
  },
  disclaimer: {
    fr: "Les informations ne constituent pas un conseil officiel.",
    ht: "Enfòmasyon yo pa konstitye yon konsèy ofisyèl.",
  },
  primaryLinks: {
    fr: [
      { href: "/news", label: "Actualités" },
      { href: "/bourses", label: "Bourses" },
      { href: "/opportunites", label: "Opportunités" },
      { href: "/haiti", label: "Haïti" },
      { href: "/ressources", label: "Ressources" },
    ],
    ht: [
      { href: "/news", label: "Nouvèl" },
      { href: "/bourses", label: "Bous" },
      { href: "/opportunites", label: "Okazyon" },
      { href: "/haiti", label: "Ayiti" },
      { href: "/ressources", label: "Resous" },
    ],
  },
  secondaryLinks: {
    fr: [
      { href: "/universites", label: "Universités" },
      { href: "/calendrier", label: "Calendrier" },
      { href: "/parcours", label: "Parcours" },
      { href: "/histoire", label: "Histoire" },
      { href: "/succes", label: "Succès" },
    ],
    ht: [
      { href: "/universites", label: "Inivèsite" },
      { href: "/calendrier", label: "Kalandriye" },
      { href: "/parcours", label: "Pakou" },
      { href: "/histoire", label: "Istwa" },
      { href: "/succes", label: "Siksè" },
    ],
  },
} as const;

export function Footer() {
  const { language: lang } = useLanguage();

  return (
    <footer className="border-t border-stone-200 bg-stone-950 dark:border-stone-800 dark:bg-stone-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Masthead in footer */}
        <div className="mb-8 border-b border-stone-800 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-2xl font-black text-white">EdLight</span>
                <span className="font-serif text-2xl font-light text-stone-500">News</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-widest text-stone-600">
                Actualités éducatives · Nouvèl edikasyon
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-600">
                {T.edition[lang]}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="max-w-xs text-sm leading-relaxed text-stone-400">
              {T.tagline[lang]}
            </p>
          </div>

          {/* Primary sections */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
              {T.headingRubriques[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              {T.primaryLinks[lang].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-stone-400 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Secondary sections */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
              {T.headingExplore[lang]}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              {T.secondaryLinks[lang].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-stone-400 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* About */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
              {T.headingAbout[lang]}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              {T.about[lang]}
            </p>
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
