import { cn } from "@/components/ui/utils";

export function OverviewSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Today's Snapshot Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-[120px] rounded-2xl bg-secondary animate-pulse" />
                ))}
            </div>

            {/* Today's Schedule Skeleton */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <div className="h-6 w-40 bg-secondary rounded-md animate-pulse" />
                </div>
                <div className="p-5 space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-10 h-4 bg-secondary rounded animate-pulse" />
                            <div className="flex-1 h-5 bg-secondary rounded animate-pulse" />
                            <div className="w-20 h-5 bg-secondary rounded-full animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Revenue Widget Skeleton */}
            <div className="h-[300px] w-full rounded-2xl bg-secondary animate-pulse" />

            {/* KPI Grid Skeleton */}
            <div className="space-y-4">
                <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-[140px] rounded-2xl bg-secondary animate-pulse" />
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
                <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-[500px] rounded-3xl bg-card border border-border flex flex-col gap-6 p-6">
                        <div className="flex justify-between">
                            <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
                            <div className="h-4 w-12 bg-secondary rounded-full animate-pulse" />
                        </div>
                        <div className="flex-1 bg-secondary rounded-xl animate-pulse" />
                        <div className="h-10 w-full bg-secondary rounded-full animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    );
}
