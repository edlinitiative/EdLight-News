/**
 * Root loading skeleton — shown while any top-level page is streaming.
 * Matches the homepage layout: hero → urgency bar → section cards.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-12">
      {/* Hero skeleton */}
      <section className="space-y-3 text-center">
        <div className="mx-auto h-10 w-72 rounded-lg bg-gray-200" />
        <div className="mx-auto h-5 w-96 rounded bg-gray-200" />
        <div className="flex justify-center gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-28 rounded-lg bg-gray-200" />
          ))}
        </div>
      </section>

      {/* Section skeleton — repeated twice */}
      {[1, 2].map((s) => (
        <section key={s} className="space-y-4 rounded-xl border-2 border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="h-6 w-56 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((c) => (
              <div key={c} className="rounded-lg border bg-white p-4">
                <div className="h-32 w-full rounded bg-gray-100" />
                <div className="mt-3 h-4 w-3/4 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
