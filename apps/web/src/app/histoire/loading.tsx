/** Loading skeleton for /histoire — premium edition */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Hero banner skeleton */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 rounded-none border-b border-stone-200/80 bg-gradient-to-br from-amber-50/60 via-stone-50/40 to-white px-4 pb-10 pt-9 sm:px-6 lg:px-8 dark:border-stone-800/60 dark:from-amber-950/30 dark:via-stone-950 dark:to-stone-950">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-700/10" />
            <div className="h-3 w-32 rounded-full bg-stone-200 dark:bg-stone-700" />
          </div>
          <div className="h-9 w-80 max-w-full rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-96 max-w-full rounded bg-stone-100 dark:bg-stone-800" />
        </div>
      </section>

      {/* Week strip skeleton */}
      <div className="flex gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-stone-50 py-3 dark:bg-stone-800/50">
            <div className="h-2 w-6 rounded-full bg-stone-200 dark:bg-stone-700" />
            <div className="h-5 w-5 rounded bg-stone-200 dark:bg-stone-700" />
          </div>
        ))}
      </div>

      {/* Explore pills skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-28 rounded-full bg-stone-200 dark:bg-stone-700" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-full bg-stone-100 dark:bg-stone-800" />
          ))}
        </div>
      </div>

      {/* Hero card skeleton */}
      <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white dark:border-stone-700/60 dark:bg-stone-800/80">
        <div className="flex flex-col sm:flex-row">
          <div className="aspect-[4/3] w-full bg-stone-100 dark:bg-stone-700 sm:aspect-auto sm:w-[40%]" />
          <div className="flex flex-1 flex-col justify-center space-y-4 p-6 sm:p-8">
            <div className="flex gap-2">
              <div className="h-6 w-14 rounded-md bg-stone-200 dark:bg-stone-700" />
              <div className="h-6 w-20 rounded-full bg-stone-100 dark:bg-stone-700" />
            </div>
            <div className="h-7 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-800" />
              <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-800" />
              <div className="h-4 w-2/3 rounded bg-stone-100 dark:bg-stone-800" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary cards skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-5 w-40 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-stone-200/80 bg-white p-5 dark:border-stone-700/60 dark:bg-stone-800/80">
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <div className="h-5 w-12 rounded-md bg-stone-100 dark:bg-stone-700" />
                  <div className="h-5 w-16 rounded-full bg-stone-100 dark:bg-stone-700" />
                </div>
                <div className="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-800" />
                <div className="h-3 w-2/3 rounded bg-stone-100 dark:bg-stone-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
