import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

export default function AttendanceLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-44" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-28" />
                </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <div className="p-4 flex items-center gap-3">
                            <Skeleton className="size-9 rounded-md" />
                            <div className="space-y-1.5">
                                <Skeleton className="h-5 w-10" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Date / centre toolbar */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-9 w-36" />
                <Skeleton className="h-9 flex-1 max-w-sm" />
            </div>

            {/* Roll call grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, i) => (
                    <Card key={i}>
                        <div className="p-4 flex items-center gap-3">
                            <Skeleton className="size-10 rounded-full flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="size-8 rounded-full" />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
