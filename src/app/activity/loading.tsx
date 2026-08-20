function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 rounded-token ${className ?? ''}`} />;
}

function FeaturedCardSkeleton() {
  return (
    <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
      <div className="h-36 animate-pulse bg-surface-2" />
      <div className="px-4 pt-3.5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonBlock className="h-5 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
        <SkeletonBlock className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

function CompactRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <SkeletonBlock className="size-10 rounded-2xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <SkeletonBlock className="h-2.5 w-20" />
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-3 w-28" />
      </div>
      <SkeletonBlock className="h-4 w-14 rounded-full shrink-0" />
    </div>
  );
}

export default function ActivityLoading() {
  return (
    <div className="min-h-screen bg-surface-page pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10">
      <div className="max-w-2xl mx-auto px-4 pt-[var(--screen-top-inset)]">

        {/* Header */}
        <div className="mb-5">
          <div className="h-8 w-24 animate-pulse bg-surface-2 rounded-token" />
          <div className="h-3 w-56 animate-pulse bg-surface-2 rounded-token mt-2" />
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 mb-6">
          <div className="flex-1 h-9 animate-pulse bg-surface-2 rounded-full" />
          <div className="flex-1 h-9 animate-pulse bg-surface-2 rounded-full" />
        </div>

        {/* Filter + Sort bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-8 animate-pulse bg-surface-2 rounded-full" />
          <div className="h-8 w-24 animate-pulse bg-surface-2 rounded-full" />
        </div>

        <div className="space-y-5">
          <FeaturedCardSkeleton />

          <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
            {/* Group header */}
            <div className="px-4 py-2 bg-surface-page">
              <div className="h-2.5 w-16 animate-pulse bg-surface-2 rounded-token" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <CompactRowSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
