function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <div className="aspect-[16/9] bg-gray-100 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between gap-2">
          <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-8 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
        <div className="flex gap-1">
          <div className="h-5 w-14 bg-gray-100 rounded-md animate-pulse" />
          <div className="h-5 w-14 bg-gray-100 rounded-md animate-pulse" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function ChargersLoading() {
  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mt-2" />
      </div>
      <div className="space-y-3 mb-5">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse shrink-0" />
          ))}
        </div>
        <div className="h-4 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
