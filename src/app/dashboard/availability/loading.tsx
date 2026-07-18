export default function AvailabilityLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-44 bg-card rounded-xl" />
                    <div className="h-4 w-36 bg-card rounded-lg" />
                </div>
                <div className="flex gap-3">
                    <div className="h-11 w-24 bg-card rounded-2xl" />
                    <div className="h-11 w-24 bg-card rounded-2xl" />
                </div>
            </div>

            {/* Calendar / 7-col × 4-row grid */}
            <div className="glassmorphic-card rounded-3xl p-6 space-y-4">
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-2">
                    {[...Array(7)].map((_, i) => (
                        <div key={i} className="h-5 w-full bg-card rounded-lg" />
                    ))}
                </div>

                {/* 4 rows of day cells */}
                {[...Array(4)].map((_, row) => (
                    <div key={row} className="grid grid-cols-7 gap-2">
                        {[...Array(7)].map((_, col) => (
                            <div
                                key={col}
                                className="h-20 w-full bg-card rounded-2xl"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
