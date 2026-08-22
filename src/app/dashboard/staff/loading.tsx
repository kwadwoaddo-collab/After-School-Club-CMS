export default function StaffLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Role-count stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-lg border border-border bg-surface h-[68px]" />
        ))}
      </div>

      {/* Segmented control */}
      <div className="h-9 w-64 bg-page rounded-md border border-border-subtle" />

      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="h-9 flex-1 max-w-sm bg-page rounded-sm border border-border-subtle" />
        <div className="h-9 w-36 bg-page rounded-sm border border-border-subtle" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-3 w-16 bg-page rounded" />
          ))}
        </div>
        <div className="divide-y divide-border-subtle">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-8 h-8 rounded-full bg-page flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 bg-page rounded" />
                <div className="h-3 w-28 bg-page rounded" />
              </div>
              <div className="h-5 w-20 bg-page rounded-sm hidden sm:block" />
              <div className="h-3 w-16 bg-page rounded hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
