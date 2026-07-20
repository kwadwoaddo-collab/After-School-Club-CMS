export default function StaffLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-9 w-52 bg-muted rounded-xl" />
          <div className="h-4 w-36 bg-muted rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-muted rounded-2xl" />
      </div>

      {/* Stats strip — 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-muted rounded-2xl h-16" />
        ))}
      </div>

      {/* Staff list container */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        {/* List header */}
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded-lg" />
          <div className="h-4 w-12 bg-muted rounded-lg ml-auto" />
        </div>

        {/* Filter bar */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="h-10 rounded-xl bg-muted w-full max-w-sm" />
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-6 w-14 bg-muted rounded-xl" />
            ))}
          </div>
          <div className="h-10 w-28 bg-muted rounded-xl ml-auto" />
        </div>

        {/* 5 accordion rows */}
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="w-10 h-10 rounded-2xl bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 bg-muted rounded-lg" />
                <div className="h-3 w-28 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
              <div className="h-5 w-16 bg-muted rounded-xl hidden sm:block" />
              <div className="h-4 w-4 bg-muted rounded ml-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
