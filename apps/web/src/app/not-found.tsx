import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-stone-100 opacity-50 blur-xl dark:bg-stone-800" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800">
          <SearchX className="h-6 w-6 text-stone-400 dark:text-stone-500" />
        </div>
      </div>
      <div className="space-y-3">
        <h1 className="font-mono text-6xl font-bold text-stone-900 dark:text-white">404</h1>
        <p className="text-base text-stone-600 dark:text-stone-300">
          Page introuvable — Paj sa a pa egziste.
        </p>
        <p className="text-sm text-stone-400 dark:text-stone-500">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lift dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
        >
          Retour à l&apos;accueil
        </Link>
        <Link
          href="/?lang=ht"
          className="rounded-lg border border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-stone-700 transition-all hover:-translate-y-0.5 hover:shadow-lift dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
        >
          Retounen lakay
        </Link>
      </div>
    </div>
  );
}
