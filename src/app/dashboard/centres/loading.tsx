export default function CentresLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-44 bg-card rounded-xl" />
                    <div className="h-4 w-36 bg-card rounded-lg" />
                </div>
                <div className="h-11 w-36 bg-primary/20 rounded-2xl" />
            </div>

            {/* Grid of 3 centre cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="glassmorphic-card rounded-3xl p-6 space-y-4">
                        {/* Centre name */}
                        <div className="h-6 w-3/4 bg-card rounded-xl" />
                        {/* Subtitle / address */}
                        <div className="space-y-1.5">
                            <div className="h-4 w-full bg-card rounded-lg" />
                            <div className="h-4 w-2/3 bg-card rounded-lg" />
                        </div>
                        {/* Action button */}
                        <div className="h-10 w-28 bg-primary/20 rounded-2xl mt-2" />
                    </div>
                ))}
            </div>
        </div>
    );
}
