export default function Loading() {
  return (
    <div className="animate-pulse space-y-10">
      {/* Hero skeleton */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900 sm:p-8">
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-stone-100 dark:bg-stone-800" />
          <div className="h-10 w-80 max-w-full rounded-lg bg-stone-100 dark:bg-stone-800" />
          <div className="h-4 w-[28rem] max-w-full rounded bg-stone-100 dark:bg-stone-800" />
          <div className="flex gap-3 pt-3">
            <div className="h-10 w-32 rounded-lg bg-stone-200 dark:bg-stone-800" />
            <div className="h-10 w-28 rounded-lg bg-stone-100 dark:bg-stone-800" />
          </div>
        </div>
      </div>

      {/* Section skeletons */}
      {[1, 2].map((s) => (
        <div key={s} className="space-y-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-4 dark:border-stone-800">
            <div className="h-6 w-48 rounded bg-stone-100 dark:bg-stone-800" />
            <div className="h-4 w-20 rounded bg-stone-100 dark:bg-stone-800" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((c) => (
              <div key={c} className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
                <div className="aspect-video bg-stone-100 dark:bg-stone-800" />
                <div className="space-y-2.5 p-4">
                  <div className="h-3 w-16 rounded bg-stone-100 dark:bg-stone-800" />
                  <div className="h-4 w-3/4 rounded bg-stone-100 dark:bg-stone-800" />
                  <div className="h-3 w-1/2 rounded bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
