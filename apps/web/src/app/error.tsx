"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[EdLight] page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/30">
        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
          Un problème est survenu
        </h2>
        <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Nous n&apos;avons pas pu charger cette page. Veuillez réessayer.
        </p>
        <p className="text-sm text-stone-400 dark:text-stone-500">
          Nou pa t kapab chaje paj sa a. Tanpri eseye ankò.
        </p>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-stone-300 dark:text-stone-700">Réf\u00a0: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
      >
        Réessayer / Eseye ankò
      </button>
    </div>
  );
}
