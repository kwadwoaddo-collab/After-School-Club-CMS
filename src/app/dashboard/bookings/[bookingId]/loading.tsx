import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

export default function BookingDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-sm" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-9 w-28 rounded-md" />
                    <Skeleton className="h-9 w-32 rounded-md" />
                </div>
            </div>

            {/* Lifecycle timeline */}
            <Card className="p-6">
                <Skeleton className="h-3 w-32 mb-4" />
                <div className="flex items-center gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                            <Skeleton className="size-5 rounded-full" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    ))}
                </div>
            </Card>

            {/* Attendee card */}
            <Card className="p-6 space-y-6">
                <div className="flex items-start justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="size-14 rounded-md" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-20 rounded-sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border-subtle">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start gap-3">
                            <Skeleton className="size-10 rounded-md flex-shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-4 w-28" />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Parent info */}
            <Card className="p-6 space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton className="size-10 rounded-md flex-shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
