/** Loading skeleton for /bourses */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900/70">
        <div className="space-y-3">
          <div className="h-8 w-56 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-96 max-w-full rounded bg-stone-200 dark:bg-stone-700" />
        </div>
      </section>
      <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900/70">
        <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-stone-200 dark:bg-stone-700" />
        ))}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="content-card p-4">
            <div className="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
            <div className="mt-2 h-3 w-full rounded bg-stone-100 dark:bg-stone-700" />
            <div className="mt-1 h-3 w-1/2 rounded bg-stone-100 dark:bg-stone-700" />
            <div className="mt-3 flex gap-2">
              <div className="h-5 w-16 rounded-full bg-stone-200 dark:bg-stone-700" />
              <div className="h-5 w-20 rounded-full bg-stone-200 dark:bg-stone-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
