export default function ReportsLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-36 bg-surface-container-high rounded-xl" />
                    <div className="h-4 w-52 bg-surface-container rounded-lg" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-28 bg-surface-container-high rounded-2xl" />
                    <div className="h-10 w-28 bg-surface-container-high rounded-2xl" />
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className={`h-10 rounded-xl bg-surface-container-high ${i === 1 ? 'w-28' : 'w-24'}`} />
                ))}
            </div>

            {/* Report content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glassmorphic-card rounded-2xl p-6 space-y-4">
                    <div className="h-5 w-32 bg-surface-container-high rounded-lg" />
                    <div className="space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="flex-1 h-3 bg-surface-container-high rounded-full" />
                                <div className="h-3 w-12 bg-surface-container rounded" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="glassmorphic-card rounded-2xl p-6">
                    <div className="h-48 bg-surface-container-high/50 rounded-xl" />
                </div>
            </div>
        </div>
    );
}
