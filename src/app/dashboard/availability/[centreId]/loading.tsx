import { Skeleton } from '@/components/ui/Skeleton';

export default function CentreAvailabilityLoading() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-label="Loading centre hours"
            className="max-w-5xl mx-auto space-y-6 py-2"
        >
            <span className="sr-only">Loading centre hours…</span>
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                </div>
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                </div>
            </div>
        </div>
    );
}
