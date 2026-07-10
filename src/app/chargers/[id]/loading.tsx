import { Skeleton } from '@/components/ui/Skeleton';

export default function ChargerDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-1">
      {/* Mobile hero skeleton */}
      <div className="md:hidden">
        <Skeleton className="w-full h-[200px] rounded-none" />
      </div>

      {/* Desktop breadcrumb skeleton */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-2">
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="max-w-6xl mx-auto md:px-6 md:pb-12">
        <div className="flex gap-8 items-start">
          <div className="flex-1 min-w-0">

            {/* Desktop hero skeleton */}
            <div className="hidden md:block mb-6">
              <Skeleton className="w-full h-[400px] rounded-token-lg" />
            </div>

            {/* Title skeleton */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-5 border-b border-border md:border-0">
              <Skeleton className="h-8 w-3/4 mb-3" />
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Spec tiles skeleton */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-5 mt-2 md:mt-0 border-b border-border md:border-0">
              <Skeleton className="h-3 w-28 mb-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>

            {/* Host skeleton */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-5 mt-2 md:mt-0 border-b border-border md:border-0">
              <Skeleton className="h-3 w-12 mb-3" />
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1.5" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>

            {/* Info rows skeleton */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-28 md:pb-6 mt-2 md:mt-0">
              <Skeleton className="h-3 w-40 mb-2" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Rail skeleton — desktop only */}
          <aside className="w-80 shrink-0 hidden md:block">
            <Skeleton className="h-72 w-full rounded-token-lg" />
          </aside>
        </div>
      </div>
    </div>
  );
}
