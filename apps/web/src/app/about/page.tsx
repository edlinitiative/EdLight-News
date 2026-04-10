import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Newspaper, BookOpen, Globe, Instagram } from "lucide-react";

export const metadata: Metadata = {
  title: "À propos · EdLight News",
  description:
    "EdLight News est une plateforme d'information et d'opportunités pour les jeunes haïtiens et la diaspora.",
};

const ABOUT_STATS = [
  { value: "30 000+", label: "lecteurs actifs" },
  { value: "2",       label: "langues de publication" },
  { value: "100 %",   label: "indépendant" },
] as const;

export default function AboutPage() {
  return (
    <>
      {/* ── Full-bleed hero ─────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-[#08142a] to-stone-950">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          {/* Eyebrow */}
          <div className="mb-5">
            <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-300">
              À propos
            </span>
          </div>

          {/* Display headline */}
          <h1
            className="mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl"
            style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
          >
            Informer.
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
              Ouvrir des portes.
            </span>
          </h1>

          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-stone-300 sm:text-xl">
            Servir la jeunesse haïtienne — une information utile, fiable et accessible
            pour les étudiants, les jeunes professionnels et la diaspora mondiale.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <Newspaper className="h-4 w-4" />
              Lire les actualités
            </Link>
            <a
              href="https://www.instagram.com/edlightnews"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-stone-700 px-5 py-2.5 text-sm font-semibold text-stone-200 transition-colors hover:border-stone-500 hover:bg-stone-800"
            >
              <Instagram className="h-4 w-4" />
              @edlightnews
            </a>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-stone-800/80 bg-stone-900/40">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <dl className="grid grid-cols-3 gap-6 text-center">
              {ABOUT_STATS.map((s) => (
                <div key={s.label}>
                  <dt
                    className="text-3xl font-extrabold text-white sm:text-4xl"
                    style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                  >
                    {s.value}
                  </dt>
                  <dd className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── Why it exists ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Pourquoi EdLight News existe
        </h2>
        <p className="mb-4 text-base leading-relaxed text-stone-600 dark:text-stone-400">
          Trop souvent, les jeunes haïtiens et la diaspora n'ont pas accès à une source
          d'information structurée, visuellement soignée et réellement utile à leur
          quotidien. Les grandes plateformes médiatiques ne couvrent pas ce qui compte
          pour eux&nbsp;: les bourses, les concours, les opportunités de carrière, les
          enjeux locaux en Haïti et les tendances globales en éducation.
        </p>
        <p className="text-base leading-relaxed text-stone-600 dark:text-stone-400">
          EdLight News comble ce vide. Nous publions des synthèses journalières, des
          reportages expliqués, des calendriers de bourses et des ressources pratiques
          — tout ce qu'un étudiant ou un jeune professionnel haïtien a besoin de
          savoir pour avancer.
        </p>
      </section>

      {/* ── What we cover ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-5 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Ce que vous trouverez ici
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: <Newspaper className="h-5 w-5" />,
              title: "Actualités & Analyses",
              desc: "Haïti, monde, éducation, business, technologie — couverture quotidienne structurée.",
            },
            {
              icon: <BookOpen className="h-5 w-5" />,
              title: "Explainers",
              desc: "Des dossiers clairs sur les enjeux complexes : politique, science, économie, droits.",
            },
            {
              icon: <Globe className="h-5 w-5" />,
              title: "Opportunités",
              desc: "Bourses, stages, concours, programmes et fellowships avec deadlines visibles.",
            },
            {
              icon: <ArrowRight className="h-5 w-5" />,
              title: "Ressources pratiques",
              desc: "Guides, calendriers académiques, ressources utiles pour l'orientation et la carrière.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {item.icon}
              </div>
              <h3 className="mb-1 text-sm font-bold text-stone-900 dark:text-white">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── EdLight ecosystem ───────────────────────────────────── */}
      <section className="mb-10 rounded-xl border border-blue-100 bg-blue-50/60 p-6 dark:border-blue-900/30 dark:bg-blue-950/20">
        <h2 className="mb-3 text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          Partie de l'écosystème EdLight
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          EdLight News est la branche éditoriale de{" "}
          <a
            href="https://edlight.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            EdLight Initiative
          </a>
          , une organisation dédiée à l'accès à l'éducation et aux opportunités pour
          les jeunes haïtiens. Si EdLight News est une publication indépendante sur le
          plan éditorial, elle partage la même mission fondamentale : informer, outiller
          et inspirer la jeunesse haïtienne.
        </p>
        <a
          href="https://edlight.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          Découvrir EdLight <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </section>

      {/* ── CTAs ────────────────────────────────────────────────── */}
      <section className="mb-4">
        <h2 className="mb-5 text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          Rejoignez la communauté
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
          >
            <Newspaper className="h-4 w-4" />
            Lire les actualités
          </Link>
          <Link
            href="/opportunites"
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Parcourir les opportunités
          </Link>
          <a
            href="https://www.instagram.com/edlightnews"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <Instagram className="h-4 w-4" />
            Suivre sur Instagram
          </a>
        </div>
      </section>
    </main>
    </>
  );
}
