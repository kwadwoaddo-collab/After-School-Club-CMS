import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

export default function NewBookingLoading() {
    return (
        <div className="max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-4 w-32" />
            </div>

            {/* Full-width form card */}
            <Card>
                <div className="p-5 sm:p-8 space-y-6">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    ))}

                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ))}
                    </div>

                    <Skeleton className="h-9 w-36 rounded-md" />
                </div>
            </Card>
        </div>
    );
}
