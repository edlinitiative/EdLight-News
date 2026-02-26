/** Loading skeleton for /universites */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <section className="section-shell p-6">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-slate-700" />
        </div>
      </section>
      <section className="section-shell p-4">
        <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-gray-200 dark:bg-slate-700" />
        ))}
        </div>
      </section>
      <div className="space-y-4">
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-slate-700" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="content-card space-y-3 p-5">
              <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-slate-700" />
              <div className="h-3 w-full rounded bg-gray-100 dark:bg-slate-700" />
              <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-slate-700" />
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-slate-700" />
                <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
