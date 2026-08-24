// D10 + D12 (Milestone 3L): Rebuilt skeleton to match actual page layout
// (filter bar + table). Previous version rendered KPI cards + card grid
// which did not match the actual rendered structure.
export default function RegistrationsLoading() {
    return (
        <div className="space-y-4 animate-pulse">
            {/* Sticky filter bar — mirrors -mx-4 sm:-mx-8 container in page.tsx */}
            <div className="-mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-background/80 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="h-9 w-52 bg-secondary rounded-xl" />
                    <div className="h-9 w-40 bg-secondary rounded-xl" />
                </div>
            </div>

            {/* Table skeleton */}
            <div className="w-full overflow-x-auto bg-card border border-border rounded-2xl shadow-sm">
                {/* Table header */}
                <div className="bg-secondary/30 border-b border-border px-4 py-3 flex items-center gap-4">
                    <div className="w-4 h-4 rounded bg-secondary flex-shrink-0" />
                    <div className="h-3 w-24 bg-secondary rounded" />
                    <div className="h-3 w-32 bg-secondary rounded" />
                    <div className="h-3 w-20 bg-secondary rounded" />
                    <div className="h-3 w-28 bg-secondary rounded" />
                    <div className="h-3 w-24 bg-secondary rounded" />
                    <div className="h-3 w-20 bg-secondary rounded ml-auto" />
                </div>
                {/* Table rows */}
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="px-4 py-3 border-b border-border/50 flex items-center gap-4 last:border-b-0">
                        <div className="w-4 h-4 rounded bg-secondary flex-shrink-0" />
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-9 h-9 rounded-full bg-secondary flex-shrink-0" />
                            <div className="h-4 w-32 bg-secondary rounded" />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <div className="w-6 h-6 rounded-full bg-secondary" />
                            <div className="h-4 w-28 bg-secondary rounded" />
                        </div>
                        <div className="h-6 w-28 bg-secondary/60 rounded-full ml-4 flex-shrink-0" />
                        <div className="h-4 w-20 bg-secondary rounded ml-4 flex-shrink-0" />
                        <div className="h-4 w-24 bg-secondary rounded flex-shrink-0" />
                        <div className="h-4 w-28 bg-secondary rounded ml-auto flex-shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
}
