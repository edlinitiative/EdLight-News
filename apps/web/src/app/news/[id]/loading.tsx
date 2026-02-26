/** Loading skeleton for article detail /news/[id]. */
export default function Loading() {
  return (
    <article className="mx-auto max-w-3xl animate-pulse space-y-6">
      {/* Hero image */}
      <div className="aspect-video w-full rounded-xl bg-gray-200 dark:bg-slate-700" />

      {/* Meta badges */}
      <div className="flex gap-2">
        <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-slate-700" />
        <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-slate-700" />
      </div>

      {/* Date */}
      <div className="h-4 w-48 rounded bg-gray-200 dark:bg-slate-700" />

      {/* Title */}
      <div className="space-y-2">
        <div className="h-8 w-full rounded-lg bg-gray-200 dark:bg-slate-700" />
        <div className="h-8 w-3/4 rounded-lg bg-gray-200 dark:bg-slate-700" />
      </div>

      {/* Summary */}
      <div className="h-5 w-full rounded bg-gray-100 dark:bg-slate-700" />
      <div className="h-5 w-5/6 rounded bg-gray-100 dark:bg-slate-700" />

      {/* Body lines */}
      <div className="space-y-3 pt-4">
        {[90, 85, 95, 78, 88, 70, 92, 80].map((w, i) => (
          <div
            key={i}
            className="h-4 rounded bg-gray-100 dark:bg-slate-800"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </article>
  );
}
