/** Loading skeleton for /closing-soon */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <section className="section-shell p-6">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-slate-700" />
        </div>
      </section>
      <section className="section-shell p-4">
        <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-full bg-gray-200 dark:bg-slate-700" />
        ))}
        </div>
      </section>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="premium-card flex items-start gap-4 p-4">
            <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-200 dark:bg-slate-700" />
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
