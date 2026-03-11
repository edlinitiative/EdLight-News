import Link from "next/link";
import { SearchX, Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-8 px-4 text-center">
      {/* Decorative glow */}
      <div className="relative">
        <div className="absolute -inset-8 animate-pulse-soft rounded-full bg-gradient-to-br from-blue-100 via-stone-100 to-violet-100 opacity-60 blur-2xl dark:from-blue-950/40 dark:via-stone-800/40 dark:to-violet-950/40" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-white shadow-soft dark:border-stone-700 dark:bg-stone-800">
          <SearchX className="h-7 w-7 text-stone-400 dark:text-stone-500" />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="font-serif text-7xl font-black tracking-tight text-stone-900 dark:text-white">
          404
        </h1>
        <p className="text-lg font-medium text-stone-700 dark:text-stone-200">
          Page introuvable
        </p>
        <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
          <br />
          <span className="text-stone-400 dark:text-stone-500">Paj sa a pa egziste oswa li te deplase.</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lift dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
        >
          <Home className="h-4 w-4" />
          Retour à l&apos;accueil
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/?lang=ht"
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-stone-700 transition-all hover:-translate-y-0.5 hover:shadow-lift dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
        >
          Retounen lakay
        </Link>
      </div>

      {/* Quick nav hints */}
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        {[
          { href: "/news", label: "Actualités" },
          { href: "/bourses", label: "Bourses" },
          { href: "/calendrier", label: "Calendrier" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-stone-150 bg-stone-50 px-3 py-1.5 text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-200"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
