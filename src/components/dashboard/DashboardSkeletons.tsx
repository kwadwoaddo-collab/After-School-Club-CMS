/**
 * Dashboard Skeleton Loaders
 *
 * Provides shimmer placeholders that display while dashboard
 * sub-sections are streaming via React Suspense boundaries.
 */

export function KpiGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
      aria-busy="true"
      aria-label="Loading key performance indicators"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-secondary p-5 rounded-2xl border border-border/20"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg skeleton-shimmer" />
            <div className="w-12 h-5 rounded-full skeleton-shimmer" />
          </div>
          <div className="w-24 h-4 rounded skeleton-shimmer mb-2" />
          <div className="w-16 h-8 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function CentreCapacitySkeleton() {
  return (
    <div
      className="bg-secondary p-8 rounded-[32px] border border-border/20 shadow-xl"
      aria-busy="true"
      aria-label="Loading centre capacity"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="w-56 h-6 rounded skeleton-shimmer mb-2" />
          <div className="w-72 h-4 rounded skeleton-shimmer" />
        </div>
        <div className="w-24 h-4 rounded skeleton-shimmer" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border border-border/10 rounded-2xl p-5 h-40 skeleton-shimmer"
          />
        ))}
      </div>
    </div>
  );
}

export function ModuleCardSkeleton() {
  return (
    <div
      className="bg-secondary p-8 rounded-3xl border border-border/20 flex flex-col gap-8"
      aria-busy="true"
      aria-label="Loading module"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl skeleton-shimmer" />
          <div>
            <div className="w-40 h-5 rounded skeleton-shimmer mb-2" />
            <div className="w-28 h-3 rounded skeleton-shimmer" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border/20 h-16 skeleton-shimmer"
          />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl border border-border/20 skeleton-shimmer"
          />
        ))}
      </div>
      <div className="h-11 rounded-xl border border-border/20 skeleton-shimmer" />
    </div>
  );
}

export function StudentEcosystemSkeleton() {
  return (
    <div
      className="bg-card rounded-2xl p-6 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-border/20"
      aria-busy="true"
      aria-label="Loading student overview"
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl skeleton-shimmer" />
        <div>
          <div className="w-40 h-6 rounded skeleton-shimmer mb-2" />
          <div className="w-56 h-4 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="w-36 h-11 rounded-xl skeleton-shimmer" />
    </div>
  );
}

/**
 * Full dashboard skeleton — renders all sections at once.
 * Use as the fallback for the outermost Suspense boundary.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      {/* Header placeholder */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="w-40 h-9 rounded skeleton-shimmer mb-2" />
          <div className="w-56 h-4 rounded skeleton-shimmer" />
        </div>
        <div className="w-48 h-10 rounded-xl skeleton-shimmer" />
      </div>

      <KpiGridSkeleton />
      <CentreCapacitySkeleton />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ModuleCardSkeleton />
        <ModuleCardSkeleton />
        <ModuleCardSkeleton />
      </div>

      <StudentEcosystemSkeleton />
    </div>
  );
}
