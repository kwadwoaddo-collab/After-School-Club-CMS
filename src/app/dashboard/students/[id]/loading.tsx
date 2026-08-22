import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

export default function StudentDetailLoading() {
    return (
        <div className="max-w-4xl mx-auto space-y-5">
            {/* Nav bar */}
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-32" />
            </div>

            {/* Header card */}
            <Card>
                <div className="p-5 flex items-center gap-5">
                    <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-52" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
            </Card>

            {/* Tabs skeleton */}
            <div className="flex gap-4 border-b border-border pb-2.5">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-4 w-16" />
                ))}
            </div>

            {/* Content area — 2 columns */}
            <Card>
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-3">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
