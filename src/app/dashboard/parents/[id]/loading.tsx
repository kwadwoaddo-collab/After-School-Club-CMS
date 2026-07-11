export default function ParentDetailLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header with avatar circle + name */}
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex-shrink-0" />
                <div className="space-y-2">
                    <div className="h-7 w-48 bg-surface-container-high rounded-xl" />
                    <div className="h-4 w-32 bg-surface-container rounded-lg" />
                </div>
            </div>

            {/* 2-col grid: contact card + stats card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contact card */}
                <div className="glassmorphic-card rounded-3xl p-6 space-y-5">
                    <div className="h-5 w-1/3 bg-surface-container-high rounded-xl" />
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded bg-surface-container-high flex-shrink-0" />
                            <div className="h-4 w-48 bg-surface-container rounded-lg" />
                        </div>
                    ))}
                </div>

                {/* Stats card */}
                <div className="glassmorphic-card rounded-3xl p-6 space-y-5">
                    <div className="h-5 w-1/3 bg-surface-container-high rounded-xl" />
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="glassmorphic-card rounded-2xl p-4 space-y-2">
                                <div className="h-7 w-10 bg-surface-container-high rounded-lg" />
                                <div className="h-3 w-20 bg-surface-container rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
