/** Loading skeleton for /bourses (v2 — matches premium redesign layout) */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-8 px-4 sm:px-6">
      {/* Header skeleton */}
      <header className="space-y-3 pt-2">
        <div className="h-px w-full bg-stone-200 dark:bg-stone-700" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-lg bg-stone-200 dark:bg-stone-700" />
            <div className="h-4 w-96 max-w-full rounded bg-stone-100 dark:bg-stone-800" />
          </div>
          <div className="h-8 w-24 rounded-xl bg-stone-200 dark:bg-stone-700" />
        </div>
      </header>

      {/* Deadline board skeleton */}
      <section className="mx-auto max-w-6xl space-y-3">
        <div className="h-5 w-40 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[220px] rounded-xl border border-stone-200 bg-white p-3.5 dark:border-stone-700 dark:bg-stone-900/60">
              <div className="h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="mt-2 flex gap-2">
                <div className="h-5 w-12 rounded-full bg-stone-100 dark:bg-stone-800" />
                <div className="h-5 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Parcours skeleton */}
      <section className="mx-auto max-w-6xl space-y-3">
        <div className="h-5 w-32 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
              <div className="h-8 w-8 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="mt-2 h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="mt-1 h-3 w-full rounded bg-stone-100 dark:bg-stone-800" />
            </div>
          ))}
        </div>
      </section>

      {/* Filter bar skeleton */}
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-xl bg-stone-100 dark:bg-stone-800" />
            <div className="h-9 w-20 rounded-xl bg-stone-200 dark:bg-stone-700" />
          </div>
          <div className="mt-3 flex gap-2 border-t border-stone-100 pt-2.5 dark:border-stone-800">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 w-24 rounded-lg bg-stone-100 dark:bg-stone-800" />
            ))}
          </div>
        </div>

        {/* Card grid skeleton */}
        <div className="grid gap-5 md:grid-cols-[240px,minmax(0,1fr)]">
          <div className="hidden rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900 md:block">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mb-3 space-y-1.5">
                <div className="h-3 w-16 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="flex gap-1.5">
                  <div className="h-7 w-14 rounded-lg bg-stone-100 dark:bg-stone-800" />
                  <div className="h-7 w-14 rounded-lg bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
                <div className="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="mt-2.5 flex gap-1.5">
                  <div className="h-5 w-8 rounded-md bg-stone-100 dark:bg-stone-800" />
                  <div className="h-5 w-28 rounded bg-stone-100 dark:bg-stone-800" />
                  <div className="h-5 w-16 rounded-full bg-blue-50 dark:bg-blue-900/20" />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-800" />
                  <div className="h-3 w-2/3 rounded bg-stone-100 dark:bg-stone-800" />
                </div>
                <div className="mt-4 flex gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                  <div className="h-7 w-24 rounded-lg bg-stone-900 dark:bg-stone-200" />
                  <div className="h-7 w-16 rounded-lg bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
