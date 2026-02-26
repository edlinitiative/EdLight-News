import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * Global 404 page — bilingual (FR / HT).
 * Shown when notFound() is called or a route doesn't match.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <SearchX className="h-14 w-14 text-brand-400 dark:text-brand-500" />
      <h1 className="font-serif text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
        404
      </h1>
      <p className="text-lg text-gray-600 dark:text-slate-300">
        Page introuvable — Paj sa a pa egziste.
      </p>
      <p className="text-sm text-gray-500 dark:text-slate-400">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          Retour à l&apos;accueil
        </Link>
        <Link
          href="/?lang=ht"
          className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/30"
        >
          Retounen lakay
        </Link>
      </div>
    </div>
  );
}
