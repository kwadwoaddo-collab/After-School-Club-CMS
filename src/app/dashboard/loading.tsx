export default function DashboardLoading() {
    return (
        <div className="flex flex-col p-8 space-y-6 max-w-[1400px] mx-auto animate-pulse" role="status" aria-label="Loading dashboard">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-64 bg-secondary rounded-lg"></div>
                    <div className="h-4 w-40 bg-secondary rounded-md"></div>
                </div>
                <div className="h-10 w-32 bg-secondary rounded-lg"></div>
            </div>

            {/* KPI Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 bg-secondary rounded-xl border border-border"></div>
                ))}
            </div>

            {/* Charts/Content Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-96 bg-secondary rounded-xl border border-border"></div>
                <div className="h-96 bg-secondary rounded-xl border border-border"></div>
            </div>
        </div>
    );
}
