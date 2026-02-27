/** Loading skeleton for /histoire */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <section className="rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-8">
        <div className="space-y-3">
          <div className="h-6 w-48 rounded-full bg-white/20" />
          <div className="h-10 w-72 rounded bg-white/20" />
          <div className="h-4 w-96 max-w-full rounded bg-white/15" />
        </div>
      </section>
      {/* Hero card skeleton */}
      <div className="section-shell space-y-4">
        <div className="relative z-10 h-6 w-56 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-700" />
          <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-700" />
          <div className="h-4 w-3/4 rounded bg-stone-100 dark:bg-stone-700" />
        </div>
      </div>
      {/* Week cards skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-40 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="content-card space-y-2 p-4">
              <div className="h-4 w-16 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-700" />
              <div className="h-3 w-2/3 rounded bg-stone-100 dark:bg-stone-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
