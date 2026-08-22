import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

export default function StudentsLoading() {
    return (
        <div className="space-y-6">
            {/* KPI stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
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

            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 flex-1 max-w-sm" />
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-9 w-32" />
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="h-11 border-b border-border" />
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border-subtle last:border-0">
                        <Skeleton className="size-8 rounded-full flex-shrink-0" />
                        <div className="space-y-1.5 flex-1">
                            <Skeleton className="h-4 w-40" />
                        </div>
                        <Skeleton className="h-4 w-16 hidden sm:block" />
                        <Skeleton className="h-4 w-20 hidden md:block" />
                    </div>
                ))}
            </div>
        </div>
    );
}
