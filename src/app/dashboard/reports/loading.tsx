export default function ReportsLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Tab bar */}
      <div className="flex gap-2">
        {[1,2,3,4].map(i => <div key={i} className="h-9 w-32 rounded-full bg-muted" />)}
      </div>
      {/* Config card */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="h-5 w-48 rounded-lg bg-muted" />
        <div className="flex gap-2">
          {[1,2,3].map(i => <div key={i} className="h-8 w-24 rounded-full bg-muted" />)}
        </div>
        <div className="h-10 w-32 rounded-xl bg-muted" />
      </div>
      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-2xl bg-muted" />)}
      </div>
      {/* Table rows */}
      {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted" />)}
    </div>
  );
}
