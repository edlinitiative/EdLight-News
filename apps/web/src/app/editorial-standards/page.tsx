import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Standards éditoriaux · EdLight News",
  description:
    "Les principes éditoriaux d'EdLight News : exactitude, clarté, équité et utilité.",
};

export default function EditorialStandardsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── Eyebrow ─────────────────────────────────────────────── */}
      <div className="mb-3">
        <span className="inline-block rounded bg-stone-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-stone-600 dark:bg-stone-800 dark:text-stone-400">
          Standards éditoriaux
        </span>
      </div>

      <h1
        className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-stone-900 dark:text-white sm:text-5xl"
        style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
      >
        Notre engagement envers la qualité éditoriale
      </h1>
      <p className="mb-10 text-lg leading-relaxed text-stone-600 dark:text-stone-300">
        EdLight News est engagée envers une information rigoureuse, utile et
        honnête. Cette page décrit comment nous travaillons, comment nous
        sélectionnons nos contenus et comment nous gérons les erreurs.
      </p>

      <hr className="mb-10 border-stone-200 dark:border-stone-800" />

      {/* ── Principles ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Nos principes éditoriaux
        </h2>
        <div className="space-y-4">
          {[
            {
              title: "Exactitude",
              desc: "Nous ne publions que des informations que nous pouvons vérifier ou qui proviennent de sources identifiables. En cas de doute, nous signalons l'incertitude.",
            },
            {
              title: "Clarté",
              desc: "Nous rédigeons pour être compris. Nos articles, explainers et synthèses visent une lisibilité maximale, sans jargon inutile.",
            },
            {
              title: "Équité",
              desc: "Nous couvrons les événements et enjeux sans parti pris déclaré. Quand nous offrons une perspective éditoriale, nous l'identifions clairement.",
            },
            {
              title: "Utilité",
              desc: "Chaque article, explainer ou fiche d'opportunité doit apporter une valeur concrète au lecteur. Nous n'ajoutons pas de contenu pour le volume.",
            },
            {
              title: "Responsabilité",
              desc: "Nous corrigeons les erreurs rapidement et de manière transparente. Nous ne supprimons pas les articles, nous les amendons avec une note de correction.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="mb-1 text-base font-bold text-stone-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Content standards ───────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Standards de contenu
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              Sélection des articles
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Nous sélectionnons les articles en fonction de leur pertinence pour notre
              lectorat (jeunes haïtiens, étudiants, diaspora) et de leur valeur
              informationnelle. Nous privilégions les sujets liés à Haïti, à
              l'éducation, aux opportunités, à l'économie et à la technologie.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              Sélection des opportunités
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Les opportunités publiées (bourses, stages, concours, fellowships) doivent
              avoir une source officielle identifiable. Nous indiquons la date limite et
              recommandons toujours de vérifier les informations sur le site officiel
              avant de postuler.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              Ton et présentation
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Notre ton est direct, clair et respectueux. Nous évitons le
              sensationnalisme, les titres trompeurs et les formulations alarmistes
              non justifiées. Nous n'utilisons jamais de clickbait.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold text-stone-900 dark:text-white">
              Corrections et mises à jour
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Toute erreur signalée est évaluée dans les 24 heures. Si une correction
              s'impose, elle est publiée avec une note visible en tête d'article. Les
              articles ne sont jamais supprimés, sauf cas exceptionnels de contenu
              manifestement erroné et potentiellement nuisible.
            </p>
          </div>
        </div>
      </section>

      {/* ── Contact for corrections ──────────────────────────────── */}
      <section className="rounded-xl border border-stone-200 bg-stone-50 p-6 dark:border-stone-800 dark:bg-stone-900/50">
        <h2 className="mb-2 text-lg font-bold text-stone-900 dark:text-white">
          Signaler une erreur ou nous contacter
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          Vous avez repéré une inexactitude, une information obsolète ou un problème
          éditorial ? Écrivez-nous à{" "}
          <a
            href="mailto:contact@edlightinitiative.org"
            className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            contact@edlightinitiative.org
          </a>
          . Nous lisons tous les messages.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          Page de contact <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </main>
  );
}
