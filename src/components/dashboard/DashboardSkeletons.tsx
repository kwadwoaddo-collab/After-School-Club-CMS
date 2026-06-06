/**
 * Dashboard Skeleton Loaders
 *
 * Provides shimmer placeholders that display while dashboard
 * sub-sections are streaming via React Suspense boundaries.
 */

export function KpiGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      aria-busy="true"
      aria-label="Loading key performance indicators"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/10 animate-pulse"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-surface-bright" />
            <div className="w-12 h-5 rounded-full bg-surface-bright" />
          </div>
          <div className="w-24 h-4 rounded bg-surface-bright mb-2" />
          <div className="w-16 h-8 rounded bg-surface-bright" />
        </div>
      ))}
    </div>
  );
}

export function CentreCapacitySkeleton() {
  return (
    <div
      className="bg-surface-container-high p-8 rounded-[32px] border border-outline-variant/10 shadow-xl animate-pulse"
      aria-busy="true"
      aria-label="Loading centre capacity"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="w-56 h-6 rounded bg-surface-bright mb-2" />
          <div className="w-72 h-4 rounded bg-surface-bright" />
        </div>
        <div className="w-24 h-4 rounded bg-surface-bright" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface-container-low/50 border border-outline-variant/5 rounded-2xl p-5 h-40"
          />
        ))}
      </div>
    </div>
  );
}

export function ModuleCardSkeleton() {
  return (
    <div
      className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10 animate-pulse flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading module"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-bright" />
          <div>
            <div className="w-40 h-5 rounded bg-surface-bright mb-2" />
            <div className="w-28 h-3 rounded bg-surface-bright" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10 h-16"
          />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-surface-container-low border border-outline-variant/10"
          />
        ))}
      </div>
      <div className="h-11 rounded-xl bg-surface-container-low border border-outline-variant/10" />
    </div>
  );
}

export function StudentEcosystemSkeleton() {
  return (
    <div
      className="bg-surface-container-low rounded-2xl p-6 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-outline-variant/10 animate-pulse"
      aria-busy="true"
      aria-label="Loading student overview"
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl bg-surface-bright" />
        <div>
          <div className="w-40 h-6 rounded bg-surface-bright mb-2" />
          <div className="w-56 h-4 rounded bg-surface-bright" />
        </div>
      </div>
      <div className="w-36 h-11 rounded-xl bg-surface-container-high" />
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
          <div className="w-40 h-9 rounded bg-surface-bright animate-pulse mb-2" />
          <div className="w-56 h-4 rounded bg-surface-bright animate-pulse" />
        </div>
        <div className="w-48 h-10 rounded-xl bg-surface-container-high animate-pulse" />
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
