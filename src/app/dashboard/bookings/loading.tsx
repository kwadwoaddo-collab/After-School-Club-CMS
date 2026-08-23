import { Skeleton } from '@/components/ui/Skeleton';

export default function BookingsLoading() {
    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 flex-1 max-w-sm" />
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-32" />
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="h-11 border-b border-border" />
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border-subtle last:border-0">
                        <Skeleton className="size-4 rounded-sm flex-shrink-0" />
                        <div className="space-y-1.5 flex-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                        <Skeleton className="h-4 w-20 hidden md:block" />
                        <Skeleton className="h-5 w-16 rounded-sm hidden sm:block" />
                    </div>
                ))}
            </div>
        </div>
    );
}
