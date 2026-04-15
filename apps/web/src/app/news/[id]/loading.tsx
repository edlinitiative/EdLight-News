/** Loading skeleton for article detail /news/[id]. */
export default function Loading() {
  return (
    <div className="relative mx-auto max-w-4xl xl:flex xl:gap-10">
      {/* ── Side-rail skeleton (xl+ only) ───────────────────────────── */}
      <aside className="hidden xl:flex w-14 flex-col items-center gap-4 self-start sticky top-28 pt-6 animate-pulse">
        <div className="h-14 w-14 rounded-full bg-stone-200 dark:bg-stone-700" />
        <div className="h-px w-8 bg-stone-200 dark:bg-stone-700" />
        <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
        <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
        <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
        <div className="h-px w-8 bg-stone-200 dark:bg-stone-700" />
        <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
      </aside>

      {/* ── Main article skeleton ───────────────────────────────────── */}
      <article className="min-w-0 flex-1 animate-pulse space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-12 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-3 w-3 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-3 w-16 rounded bg-stone-200 dark:bg-stone-700" />
        </div>

        {/* Hero image */}
        <div className="aspect-video w-full rounded-2xl bg-stone-200 dark:bg-stone-700" />

        {/* Eyebrow badges */}
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full bg-stone-200 dark:bg-stone-700" />
          <div className="h-6 w-16 rounded-full bg-stone-200 dark:bg-stone-700" />
        </div>

        {/* Title */}
        <div className="space-y-3">
          <div className="h-9 w-full rounded-lg bg-stone-200 dark:bg-stone-700" />
          <div className="h-9 w-4/5 rounded-lg bg-stone-200 dark:bg-stone-700" />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3">
          <div className="h-3.5 w-16 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-3.5 w-24 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-3.5 w-20 rounded bg-stone-200 dark:bg-stone-700" />
        </div>

        {/* Trust badges */}
        <div className="flex gap-3">
          <div className="h-5 w-28 rounded-md bg-stone-100 dark:bg-stone-800" />
          <div className="h-5 w-24 rounded-md bg-stone-100 dark:bg-stone-800" />
        </div>

        {/* Summary with accent border */}
        <div className="border-l-4 border-stone-200 pl-5 dark:border-stone-700">
          <div className="h-5 w-full rounded bg-stone-100 dark:bg-stone-800" />
          <div className="mt-2 h-5 w-5/6 rounded bg-stone-100 dark:bg-stone-800" />
        </div>

        {/* Share buttons (mobile) */}
        <div className="flex items-center gap-3 xl:hidden">
          <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
          <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
          <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
          <div className="h-9 w-9 rounded-xl bg-stone-200 dark:bg-stone-700" />
        </div>

        {/* Body lines */}
        <div className="space-y-3 border-t border-stone-200/80 pt-10 dark:border-stone-800">
          {[92, 88, 96, 80, 90, 72, 94, 85, 78, 91, 68, 86].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-stone-100 dark:bg-stone-800"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>

        {/* Related articles */}
        <div className="mt-14 space-y-4">
          <div className="h-6 w-32 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-stone-200/80 p-3 dark:border-stone-700">
                <div className="aspect-[3/2] rounded-xl bg-stone-200 dark:bg-stone-700" />
                <div className="mt-3 h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="mt-2 h-3 w-full rounded bg-stone-100 dark:bg-stone-800" />
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
