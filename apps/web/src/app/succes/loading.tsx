/** Loading skeleton for /succes */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <section className="section-shell p-6">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-80 max-w-full rounded bg-stone-100 dark:bg-stone-700" />
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="content-card overflow-hidden">
            <div className="aspect-video bg-stone-100 dark:bg-stone-700" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-700" />
              <div className="h-3 w-2/3 rounded bg-stone-100 dark:bg-stone-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
