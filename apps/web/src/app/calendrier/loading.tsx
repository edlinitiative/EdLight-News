/** Loading skeleton for /calendrier */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <section className="section-shell p-6">
        <div className="h-8 w-64 rounded bg-gray-200 dark:bg-slate-700" />
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="content-card flex items-start gap-3 p-4">
            <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-slate-700" />
              <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
