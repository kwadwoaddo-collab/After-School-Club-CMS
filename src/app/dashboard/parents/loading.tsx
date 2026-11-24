import { Skeleton } from '@/components/ui/Skeleton';

export default function ParentsLoading() {
    return (
        <div className="space-y-6">
            {/* Search bar skeleton */}
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-full max-w-sm rounded-md" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="h-11 bg-page border-b border-border" />
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border-subtle last:border-0">
                        {/* Avatar */}
                        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                        {/* Name + email */}
                        <div className="space-y-1.5 flex-1">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-52" />
                        </div>
                        {/* Child chip */}
                        <Skeleton className="h-5 w-20 rounded-sm" />
                    </div>
                ))}
            </div>
        </div>
    );
}
