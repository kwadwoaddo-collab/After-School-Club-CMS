export default function StudentDetailLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-52 bg-surface-container-high rounded-xl" />
                    <div className="h-4 w-36 bg-surface-container rounded-lg" />
                </div>
                <div className="h-11 w-28 bg-primary/20 rounded-2xl" />
            </div>

            {/* Tabs skeleton */}
            <div className="glassmorphic-card rounded-3xl px-4 py-2 flex gap-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 w-28 bg-surface-container-high rounded-xl" />
                ))}
            </div>

            {/* Content area – 2 cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                    <div key={i} className="glassmorphic-card rounded-3xl p-6 space-y-4">
                        <div className="h-5 w-1/3 bg-surface-container-high rounded-xl" />
                        <div className="space-y-2.5">
                            {[1, 2, 3, 4].map((j) => (
                                <div key={j} className="h-4 w-full bg-surface-container rounded-lg" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
