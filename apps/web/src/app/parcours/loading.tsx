/** Loading skeleton for /parcours */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <section className="section-shell p-6">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-slate-700" />
        </div>
      </section>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="section-shell p-0">
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-6 dark:from-slate-800 dark:to-slate-800/70">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-gray-200 dark:bg-slate-700" />
                <div className="space-y-2">
                  <div className="h-5 w-48 rounded bg-gray-200 dark:bg-slate-700" />
                  <div className="h-3 w-20 rounded bg-gray-100 dark:bg-slate-700" />
                </div>
              </div>
            </div>
            <div className="divide-y dark:divide-slate-700">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex gap-4 p-4">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-slate-700" />
                    <div className="h-3 w-full rounded bg-gray-100 dark:bg-slate-700" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
