export default function AttendanceLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-44 bg-surface-container-high rounded-xl" />
                    <div className="h-4 w-48 bg-surface-container rounded-lg" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-28 bg-surface-container-high rounded-2xl" />
                    <div className="h-10 w-28 bg-primary/20 rounded-2xl" />
                </div>
            </div>

            {/* Session selector */}
            <div className="glassmorphic-card rounded-2xl p-4">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-48 bg-surface-container-high rounded-xl" />
                    <div className="h-10 w-36 bg-surface-container-high rounded-xl" />
                    <div className="h-10 w-32 bg-surface-container-high rounded-xl" />
                </div>
            </div>

            {/* Roll call grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className="glassmorphic-card rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-container-high flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-28 bg-surface-container-high rounded-lg" />
                            <div className="h-3 w-20 bg-surface-container rounded" />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-surface-container-high" />
                    </div>
                ))}
            </div>
        </div>
    );
}
