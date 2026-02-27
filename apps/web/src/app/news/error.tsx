"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[EdLight] /news error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-stone-400 dark:text-stone-500" />
      <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
        Un problème est survenu
      </h2>
      <p className="text-stone-600 dark:text-stone-400">
        Nous n&apos;avons pas pu charger cette page. Veuillez réessayer.
      </p>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Nou pa t kapab chaje paj sa a. Tanpri eseye ankò.
      </p>
      {error.digest && (
        <p className="text-xs text-stone-400">Réf\u00a0: {error.digest}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lift dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="rounded-xl border border-stone-200 px-6 py-2.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          Accueil
        </Link>
      </div>
    </div>
  );
}
