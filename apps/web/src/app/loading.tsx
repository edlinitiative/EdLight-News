/**
 * Root loading skeleton — shown while any top-level page is streaming.
 * Matches the homepage layout: hero → urgency bar → section cards.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <section className="section-shell p-0">
        <div className="rounded-2xl p-6 sm:p-8">
          <div className="space-y-4">
            <div className="h-6 w-44 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="h-10 w-80 max-w-full rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="h-5 w-[32rem] max-w-full rounded-lg bg-gray-200 dark:bg-slate-700" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl border border-gray-200/80 bg-white/80 dark:border-slate-700/70 dark:bg-slate-900/60" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section skeleton — repeated twice */}
      {[1, 2].map((s) => (
        <section key={s} className="section-shell space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-56 rounded-lg bg-gray-200 dark:bg-slate-700" />
            <div className="h-4 w-24 rounded-lg bg-gray-200 dark:bg-slate-700" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((c) => (
              <div key={c} className="premium-card p-5">
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
