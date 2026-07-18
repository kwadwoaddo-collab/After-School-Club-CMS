export default function ParentsLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-36 bg-card rounded-xl" />
                    <div className="h-4 w-28 bg-card rounded-lg" />
                </div>
                <div className="h-11 w-32 bg-primary/20 rounded-2xl" />
            </div>

            {/* Search bar skeleton */}
            <div className="glassmorphic-card rounded-3xl px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="h-9 w-full max-w-sm bg-card rounded-xl" />
                </div>
            </div>

            {/* Table */}
            <div className="glassmorphic-card rounded-2xl overflow-hidden">
                <div className="h-12 bg-card/50 border-b border-outline-variant/10" />
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-outline-variant/5">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-card flex-shrink-0" />
                        {/* Name + email */}
                        <div className="space-y-1.5 flex-1">
                            <div className="h-4 w-40 bg-card rounded-lg" />
                            <div className="h-3 w-52 bg-card rounded" />
                        </div>
                        {/* Badge */}
                        <div className="h-5 w-20 bg-card rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}
