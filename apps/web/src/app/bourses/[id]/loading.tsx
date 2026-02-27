/** Loading skeleton for scholarship detail /bourses/[id]. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-6">
      {/* Back link */}
      <div className="h-4 w-36 rounded bg-stone-200 dark:bg-stone-700" />

      {/* Title */}
      <div className="space-y-2">
        <div className="h-8 w-full rounded-lg bg-stone-200 dark:bg-stone-700" />
        <div className="h-4 w-40 rounded bg-stone-100 dark:bg-stone-700" />
      </div>

      {/* Badges */}
      <div className="flex gap-2">
        <div className="h-7 w-24 rounded-full bg-stone-200 dark:bg-stone-700" />
        <div className="h-7 w-32 rounded-full bg-stone-200 dark:bg-stone-700" />
      </div>

      {/* Description */}
      <div className="space-y-2 pt-2">
        <div className="h-5 w-28 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="h-4 w-full rounded bg-stone-100 dark:bg-stone-700" />
        <div className="h-4 w-5/6 rounded bg-stone-100 dark:bg-stone-700" />
      </div>

      {/* Deadline box */}
      <div className="rounded-lg border border-stone-200 bg-blue-50/30 p-4 dark:border-stone-700 dark:bg-blue-900/10">
        <div className="h-5 w-32 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="mt-2 h-4 w-56 rounded bg-stone-100 dark:bg-stone-700" />
      </div>

      {/* Sources */}
      <div className="space-y-2 border-t pt-4 dark:border-stone-700">
        <div className="h-4 w-20 rounded bg-stone-200 dark:bg-stone-700" />
        <div className="flex gap-2">
          <div className="h-6 w-32 rounded-full bg-stone-100 dark:bg-stone-700" />
          <div className="h-6 w-28 rounded-full bg-stone-100 dark:bg-stone-700" />
        </div>
      </div>
    </div>
  );
}
