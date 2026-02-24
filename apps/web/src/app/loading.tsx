/**
 * Root loading skeleton — shown while any top-level page is streaming.
 * Matches the homepage layout: hero → urgency bar → section cards.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-14">
      {/* Hero skeleton */}
      <section className="space-y-4 text-center">
        <div className="mx-auto h-10 w-72 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="mx-auto h-5 w-96 rounded-lg bg-gray-200 dark:bg-slate-700" />
        <div className="flex justify-center gap-3 pt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-28 rounded-xl bg-gray-200 dark:bg-slate-700" />
          ))}
        </div>
      </section>

      {/* Section skeleton — repeated twice */}
      {[1, 2].map((s) => (
        <section key={s} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-card dark:border-slate-700/50 dark:bg-slate-800/60 dark:shadow-card-dark">
          <div className="flex items-center justify-between">
            <div className="h-6 w-56 rounded-lg bg-gray-200 dark:bg-slate-700" />
            <div className="h-4 w-24 rounded-lg bg-gray-200 dark:bg-slate-700" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((c) => (
              <div key={c} className="rounded-[14px] border border-gray-200 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800/80">
                <div className="h-32 w-full rounded-xl bg-gray-100 dark:bg-slate-700" />
                <div className="mt-3 h-4 w-3/4 rounded bg-gray-200 dark:bg-slate-600" />
                <div className="mt-2 h-3 w-1/2 rounded bg-gray-200 dark:bg-slate-600" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
