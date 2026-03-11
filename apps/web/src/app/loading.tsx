export default function Loading() {
  return (
    <div className="stagger-children space-y-10">
      {/* Hero skeleton */}
      <div className="animate-pulse rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900 sm:p-8">
        <div className="space-y-4">
          <div className="h-4 w-24 rounded-md bg-stone-200/70 dark:bg-stone-700/50" />
          <div className="h-10 w-80 max-w-full rounded-lg bg-stone-200/70 dark:bg-stone-700/50" />
          <div className="h-4 w-[28rem] max-w-full rounded-md bg-stone-100 dark:bg-stone-800" />
          <div className="flex gap-3 pt-3">
            <div className="h-10 w-32 rounded-lg bg-stone-200/80 dark:bg-stone-700/60" />
            <div className="h-10 w-28 rounded-lg bg-stone-100 dark:bg-stone-800" />
          </div>
        </div>
      </div>

      {/* Quick stats skeleton */}
      <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5 dark:border-stone-800 dark:bg-stone-900">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-stone-100 dark:bg-stone-800" />
            <div className="space-y-1.5">
              <div className="h-5 w-8 rounded bg-stone-200/70 dark:bg-stone-700/50" />
              <div className="h-3 w-16 rounded bg-stone-100 dark:bg-stone-800" />
            </div>
          </div>
        ))}
      </div>

      {/* Section skeletons */}
      {[1, 2].map((s) => (
        <div key={s} className="animate-pulse space-y-5">
          <div className="flex items-center justify-between border-b-2 border-stone-900 pb-4 dark:border-stone-100">
            <div className="h-4 w-48 rounded bg-stone-200/70 dark:bg-stone-700/50" />
            <div className="h-3 w-20 rounded bg-stone-100 dark:bg-stone-800" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((c) => (
              <div key={c} className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
                <div className="aspect-video bg-stone-100 dark:bg-stone-800" />
                <div className="space-y-2.5 p-4">
                  <div className="h-3 w-16 rounded-md bg-stone-200/60 dark:bg-stone-700/40" />
                  <div className="h-4 w-3/4 rounded-md bg-stone-200/70 dark:bg-stone-700/50" />
                  <div className="h-3 w-1/2 rounded-md bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
