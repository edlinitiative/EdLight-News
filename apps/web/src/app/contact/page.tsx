import type { Metadata } from "next";
import { Instagram, Mail, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact · EdLight News",
  description: "Contactez l'équipe EdLight News pour toute question, suggestion ou partenariat.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── Eyebrow ─────────────────────────────────────────────── */}
      <div className="mb-3">
        <span className="inline-block rounded bg-stone-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-stone-600 dark:bg-stone-800 dark:text-stone-400">
          Contact
        </span>
      </div>

      <h1
        className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-stone-900 dark:text-white"
        style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
      >
        Contactez-nous
      </h1>
      <p className="mb-10 text-base leading-relaxed text-stone-600 dark:text-stone-300">
        Nous lisons tous les messages et nous nous efforçons de répondre dans les
        48 heures ouvrables.
      </p>

      <hr className="mb-10 border-stone-200 dark:border-stone-800" />

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
  );
}
