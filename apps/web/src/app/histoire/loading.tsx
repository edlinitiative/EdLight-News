/** Loading skeleton for /histoire — premium editorial edition */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-0">
      {/* ── Cinematic hero skeleton ──────────────────────── */}
      <div className="relative min-h-[560px] overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950 md:min-h-[640px]">
        <div className="absolute bottom-0 left-0 p-8 md:p-12 lg:p-16">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-amber-700/30" />
              <div className="h-3 w-40 rounded-full bg-white/10" />
            </div>
            <div className="h-5 w-48 rounded-full bg-white/10" />
            <div className="h-10 w-96 max-w-full rounded bg-white/15" />
            <div className="h-4 w-80 max-w-full rounded bg-white/8" />
            <div className="h-12 w-40 rounded-xl bg-white/15" />
          </div>
        </div>
      </div>

      {/* ── Calendar strip skeleton ──────────────────────── */}
      <div className="border-b border-stone-200/50 px-2 py-4 dark:border-stone-700/30">
        <div className="mb-3 flex items-center justify-center gap-4 px-1">
          <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800" />
          <div className="h-5 w-24 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800" />
        </div>
        <div className="flex gap-1 overflow-hidden px-1">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2"
            >
              <div className="h-2 w-5 rounded-full bg-stone-100 dark:bg-stone-700" />
              <div className="h-4 w-4 rounded bg-stone-200 dark:bg-stone-700" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Event cards grid skeleton ────────────────────── */}
      <div className="pb-20 pt-12">
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px w-6 bg-stone-200 dark:bg-stone-700" />
            <div className="h-3 w-32 rounded-full bg-stone-200 dark:bg-stone-700" />
          </div>
          <div className="h-7 w-28 rounded bg-stone-200 dark:bg-stone-700" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-stone-200/40 bg-white dark:border-stone-700/20 dark:bg-stone-800/50"
            >
              <div className="aspect-[16/10] bg-stone-100 dark:bg-stone-700" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-16 rounded-full bg-stone-100 dark:bg-stone-700" />
                <div className="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-600" />
                <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-700" />
                <div className="h-3 w-2/3 rounded bg-stone-100 dark:bg-stone-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
