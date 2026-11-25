import { Skeleton } from '@/components/ui/Skeleton';

export default function ParentDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Header with avatar circle + name */}
            <div className="flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
                <div className="space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>

            {/* 2-col grid: contact card + stats card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contact card */}
                <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
                    <Skeleton className="h-5 w-1/3" />
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton className="w-5 h-5 rounded-sm flex-shrink-0" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    ))}
                </div>

                {/* Stats card */}
                <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
                    <Skeleton className="h-5 w-1/3" />
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-surface border border-border rounded-xl p-4 space-y-2">
                                <Skeleton className="h-7 w-10" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
