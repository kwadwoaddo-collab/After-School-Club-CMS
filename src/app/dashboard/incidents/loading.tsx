export default function IncidentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-9 w-48 bg-secondary rounded-2xl" />
        <div className="h-10 w-36 bg-secondary rounded-2xl" />
      </div>
      <div className="glassmorphic-card rounded-3xl overflow-hidden">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-border/50 last:border-0">
            <div className="h-8 w-8 bg-secondary rounded-xl" />
            <div className="space-y-1 flex-1">
              <div className="h-4 w-48 bg-secondary rounded-lg" />
              <div className="h-3 w-32 bg-secondary rounded-lg" />
            </div>
            <div className="h-6 w-20 bg-secondary rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
