export default function IncidentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-page rounded-lg" />
          <div className="h-4 w-80 bg-page rounded" />
        </div>
      </div>

      {/* Search + button skeleton */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="h-10 w-full sm:max-w-sm bg-page border border-border rounded-lg" />
        <div className="h-10 w-32 bg-page rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="bg-page border-b border-border px-5 py-3.5 flex gap-8">
          {['Date & Type', 'Child', 'Description', 'Logged'].map(h => (
            <div key={h} className="h-3.5 w-20 bg-border rounded" />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 bg-page rounded" />
              <div className="h-5 w-16 bg-page rounded-full" />
            </div>
            <div className="h-4 w-28 bg-page rounded ml-4" />
            <div className="h-4 flex-1 bg-page rounded" />
            <div className="h-3.5 w-14 bg-page rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
