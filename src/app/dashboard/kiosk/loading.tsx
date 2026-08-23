import { Skeleton } from '@/components/ui/Skeleton';

export default function KioskLoading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6">
            {/* Large circle */}
            <Skeleton className="w-40 h-40 rounded-full" />
            {/* Two lines of text */}
            <div className="space-y-3 flex flex-col items-center">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-5 w-48" />
            </div>
        </div>
    );
}
