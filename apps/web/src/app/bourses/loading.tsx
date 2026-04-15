/** Loading skeleton for /bourses (v3 — matches editorial redesign layout) */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-12">
      {/* ── Hero skeleton ── */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-stone-200/60 bg-gradient-to-br from-indigo-50/40 via-white to-white dark:from-indigo-950/10 dark:via-stone-950 dark:to-stone-950 dark:border-stone-800/60">
        <div className="px-4 sm:px-6 lg:px-8 pb-12 pt-10 sm:pb-14 sm:pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8 space-y-5">
              <div className="h-5 w-36 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="space-y-3">
                <div className="h-10 w-4/5 rounded-lg bg-stone-200 dark:bg-stone-700" />
                <div className="h-10 w-3/5 rounded-lg bg-stone-200 dark:bg-stone-700" />
              </div>
              <div className="space-y-2 max-w-2xl">
                <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-800" />
                <div className="h-4 w-3/4 rounded bg-stone-100 dark:bg-stone-800" />
              </div>
            </div>
            <div className="lg:col-span-4 space-y-5">
              <div className="border-l-4 border-stone-200 dark:border-stone-700 pl-5 space-y-2">
                <div className="h-3 w-20 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="h-8 w-16 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="h-3 w-32 rounded bg-stone-100 dark:bg-stone-800" />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:max-w-[260px] lg:ml-auto">
                <div className="rounded-xl border border-stone-200/80 dark:border-stone-700/60 bg-white/70 dark:bg-stone-900/60 p-3 space-y-2">
                  <div className="h-6 w-8 rounded bg-stone-200 dark:bg-stone-700" />
                  <div className="h-3 w-16 rounded bg-stone-100 dark:bg-stone-800" />
                </div>
                <div className="rounded-xl border border-stone-200/80 dark:border-stone-700/60 bg-white/70 dark:bg-stone-900/60 p-3 space-y-2">
                  <div className="h-6 w-8 rounded bg-stone-200 dark:bg-stone-700" />
                  <div className="h-3 w-16 rounded bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Deadline board skeleton ── */}
      <section className="space-y-3">
        <div className="h-5 w-40 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[220px] rounded-xl border border-stone-200 bg-white p-3.5 dark:border-stone-700 dark:bg-stone-900/60">
              <div className="h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="mt-2 flex gap-2">
                <div className="h-5 w-12 rounded-full bg-stone-100 dark:bg-stone-800" />
                <div className="h-5 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Search bar skeleton ── */}
      <section>
        <div className="rounded-xl border border-stone-200/80 dark:border-stone-700/60 bg-stone-50/60 dark:bg-stone-900/60 p-2 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[240px] h-11 rounded-lg bg-white dark:bg-stone-800" />
          <div className="h-11 w-24 rounded-lg bg-stone-100 dark:bg-stone-800" />
          <div className="h-11 w-24 rounded-lg bg-stone-100 dark:bg-stone-800" />
          <div className="h-11 w-36 rounded-lg bg-stone-200 dark:bg-stone-700 ml-auto" />
        </div>
      </section>

      {/* ── Featured scholarships skeleton ── */}
      <section className="space-y-6">
        <div className="h-8 w-48 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {[1, 2].map((i) => (
            <div key={i}>
              <div className="aspect-[16/10] rounded-xl bg-stone-100 dark:bg-stone-800 mb-5" />
              <div className="flex gap-3 mb-3">
                <div className="h-4 w-20 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="h-4 w-28 rounded bg-stone-100 dark:bg-stone-800" />
              </div>
              <div className="h-6 w-4/5 rounded bg-stone-200 dark:bg-stone-700 mb-3" />
              <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-800 mb-5" />
              <div className="border-t border-stone-200/60 dark:border-stone-700/40 pt-5 flex justify-between">
                <div className="space-y-1">
                  <div className="h-3 w-16 rounded bg-stone-100 dark:bg-stone-800" />
                  <div className="h-4 w-24 rounded bg-stone-200 dark:bg-stone-700" />
                </div>
                <div className="h-4 w-20 rounded bg-stone-100 dark:bg-stone-800" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feed + Sidebar skeleton ── */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-8 space-y-0">
            <div className="h-6 w-48 rounded bg-stone-200 dark:bg-stone-700 mb-6" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-6 border-b border-stone-200/40 dark:border-stone-700/40 flex gap-4">
                <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-4 w-16 rounded bg-stone-200 dark:bg-stone-700" />
                    <div className="h-4 w-20 rounded bg-stone-100 dark:bg-stone-800" />
                  </div>
                  <div className="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
                  <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-4 space-y-10">
            <div className="rounded-2xl border border-stone-200/60 dark:border-stone-700/40 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700" />
                <div className="space-y-1">
                  <div className="h-3 w-24 rounded bg-stone-200 dark:bg-stone-700" />
                  <div className="h-2 w-16 rounded bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
              <div className="border-l-4 border-stone-200 dark:border-stone-700 pl-4 space-y-2">
                <div className="h-4 w-full rounded bg-stone-200 dark:bg-stone-700" />
                <div className="h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
              </div>
              <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-800" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-28 rounded bg-stone-200 dark:bg-stone-700" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 w-24 rounded-full bg-stone-100 dark:bg-stone-800" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
