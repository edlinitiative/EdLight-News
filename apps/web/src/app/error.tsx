"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

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
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white">
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
        <p className="rounded-md bg-stone-50 px-3 py-1.5 font-mono text-xs text-stone-400 dark:bg-stone-900 dark:text-stone-600">
          Réf\u00a0: {error.digest}
        </p>
      )}

      <button
        onClick={reset}
        className="group inline-flex items-center gap-2 rounded-md bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
      >
        <RotateCcw className="h-4 w-4 transition-transform group-hover:-rotate-45" />
        Réessayer / Eseye ankò
      </button>
    </div>
  );
}
