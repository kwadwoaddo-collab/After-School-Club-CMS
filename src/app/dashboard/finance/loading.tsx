import { Skeleton } from '@/components/ui/Skeleton';

export default function FinanceLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-32 rounded-md" />
                    <Skeleton className="h-10 w-32 rounded-md" />
                </div>
            </div>

            {/* Revenue KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-md flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-7 w-20" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Invoices table */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="h-12 bg-page border-b border-border px-5 flex items-center gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="ml-auto h-9 w-28 rounded-md" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border-subtle last:border-0">
                        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-28" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-sm" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                ))}
            </div>
        </div>
    );
}
