/** Loading skeleton for /histoire */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-100" />
      </div>
      {/* Hero card skeleton */}
      <div className="space-y-4 rounded-lg border bg-white p-6">
        <div className="h-6 w-56 rounded bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-3/4 rounded bg-gray-100" />
        </div>
      </div>
      {/* Week cards skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-40 rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border bg-white p-4">
              <div className="h-4 w-16 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
