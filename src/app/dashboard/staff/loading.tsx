export default function StaffLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-36 bg-card rounded-xl" />
                    <div className="h-4 w-44 bg-card rounded-lg" />
                </div>
                <div className="h-11 w-32 bg-primary/20 rounded-2xl" />
            </div>

            {/* Staff cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="glassmorphic-card rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-card flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-36 bg-card rounded-lg" />
                            <div className="h-3 w-20 bg-card rounded" />
                            <div className="h-5 w-16 bg-primary/10 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
