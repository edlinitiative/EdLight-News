import type { Metadata } from "next";
import { Instagram, Mail, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact · EdLight News",
  description: "Contactez l'équipe EdLight News pour toute question, suggestion ou partenariat.",
};

export default function ContactPage() {
  return (
    <>
      {/* ── Full-bleed hero ─────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-[#08142a] to-stone-950">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          {/* Eyebrow */}
          <div className="mb-5">
            <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-300">
              Contact
            </span>
          </div>

          {/* Display headline */}
          <h1
            className="mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl"
            style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
          >
            Parlons-nous.
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
              On vous répond.
            </span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-stone-300">
            Nous lisons tous les messages et nous nous efforçons de répondre
            dans les&nbsp;48&nbsp;heures ouvrables.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── Contact channels ────────────────────────────────────── */}
      <div className="space-y-5 mb-12">

        {/* Email */}
        <div className="flex items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-stone-900 dark:text-white">
              E-mail général
            </h3>
            <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
              Questions éditoriales, corrections, suggestions de contenu.
            </p>
            <a
              href="mailto:contact@edlightinitiative.org"
              className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              contact@edlightinitiative.org
            </a>
          </div>
        </div>

        {/* Instagram */}
        <div className="flex items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400">
            <Instagram className="h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-stone-900 dark:text-white">
              Instagram
            </h3>
            <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
              Suivez-nous pour les actualités quotidiennes et les opportunités.
            </p>
            <a
              href="https://www.instagram.com/edlightnews"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-pink-700 hover:underline dark:text-pink-400"
            >
              @edlightnews
            </a>
          </div>
        </div>

        {/* EdLight main */}
        <div className="flex items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-stone-900 dark:text-white">
              EdLight Initiative
            </h3>
            <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
              Pour les partenariats institutionnels ou les collaborations avec EdLight.
            </p>
            <a
              href="https://edlight.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-stone-700 hover:underline dark:text-stone-300"
            >
              edlight.org
            </a>
          </div>
        </div>
      </div>

      {/* ── Partnerships ────────────────────────────────────────── */}
      <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-6 dark:border-blue-900/30 dark:bg-blue-950/20">
        <h2 className="mb-2 text-lg font-bold text-stone-900 dark:text-white">
          Partenariats &amp; collaborations
        </h2>
        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          Vous représentez une institution éducative, un programme de bourses ou une
          organisation souhaitant collaborer avec EdLight News ? Écrivez-nous à{" "}
          <a
            href="mailto:contact@edlightinitiative.org"
            className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            contact@edlightinitiative.org
          </a>{" "}
          avec en objet <em>«&nbsp;Partenariat EdLight News&nbsp;»</em>.
        </p>
      </section>
    </main>
    </>
  );
}
