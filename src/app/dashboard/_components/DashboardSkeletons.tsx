import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Milestone 2 Correction Pass: these loading placeholders mirror the shapes
 * of DashboardHero/KpiGrid/RevenueWidget/ActivityTab, which were reworked to
 * InvoiceFlow-aligned rounded-lg surfaces and flat borders this pass — the
 * previous rounded-2xl/rounded-3xl `bg-secondary` shimmer blocks no longer
 * matched what they were standing in for. Rebuilt on the shared Skeleton
 * primitive (InvoiceFlow's own loading treatment).
 */
export function OverviewSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Today's Snapshot Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-[120px] rounded-lg" />
                ))}
            </div>

            {/* Today's Schedule Skeleton */}
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-border-subtle">
                    <Skeleton className="h-6 w-40" />
                </div>
                <div className="p-5 space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <Skeleton className="w-10 h-4" />
                            <Skeleton className="flex-1 h-5" />
                            <Skeleton className="w-20 h-5 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Revenue Widget Skeleton */}
            <Skeleton className="h-[300px] w-full rounded-lg" />

            {/* KPI Grid Skeleton */}
            <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-[140px] rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ActivitySkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-[500px] rounded-lg bg-surface border border-border flex flex-col gap-6 p-6">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-12 rounded-full" />
                        </div>
                        <Skeleton className="flex-1" />
                        <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                ))}
            </div>
        </div>
    );
}
