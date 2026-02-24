"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Global error boundary — catches unhandled errors from any server component
 * (e.g. Firestore auth failures) and shows a user-friendly fallback instead
 * of the generic Next.js production error page.
 */
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
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-brand-500 dark:text-brand-400" />
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Un problème est survenu
      </h2>
      <p className="text-gray-600 dark:text-slate-400">
        Nous n&apos;avons pas pu charger cette page. Veuillez réessayer dans
        quelques instants.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400">Réf\u00a0: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md dark:bg-brand-500 dark:hover:bg-brand-600"
      >
        Réessayer
      </button>
    </div>
  );
}
