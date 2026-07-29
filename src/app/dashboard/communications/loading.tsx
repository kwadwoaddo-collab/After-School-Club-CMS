export default function CommunicationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-9 w-64 bg-secondary rounded-2xl" />
        <div className="h-10 w-36 bg-secondary rounded-2xl" />
      </div>
      <div className="glassmorphic-card rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="h-10 w-72 bg-secondary rounded-xl" />
        </div>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-border/50 last:border-0">
            <div className="h-5 w-5 bg-secondary rounded" />
            <div className="h-5 w-48 bg-secondary rounded-lg" />
            <div className="h-5 w-24 bg-secondary rounded-lg ml-auto" />
            <div className="h-5 w-20 bg-secondary rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
