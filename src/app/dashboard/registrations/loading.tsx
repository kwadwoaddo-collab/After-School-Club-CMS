export default function RegistrationsLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-52 bg-card rounded-xl" />
                    <div className="h-4 w-36 bg-card rounded-lg" />
                </div>
                <div className="flex gap-3">
                    <div className="h-11 w-32 bg-card rounded-2xl" />
                    <div className="h-11 w-28 bg-primary/20 rounded-2xl" />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glassmorphic-card rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-card/5 flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-8 w-16 bg-card rounded-lg" />
                            <div className="h-3 w-24 bg-card rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Bar - matches the sticky full-bleed container in page.tsx */}
            <div className="-mx-4 sm:-mx-8 px-4 sm:px-8 py-2 bg-[#0d1117]/80 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="h-9 w-52 bg-card rounded-xl" />
                    <div className="h-9 w-40 bg-card rounded-xl" />
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="glassmorphic-card rounded-[24px] p-6 min-h-[220px] flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="h-5 w-36 bg-card rounded-lg" />
                                <div className="h-3 w-16 bg-card rounded" />
                            </div>
                            <div className="h-5 w-20 bg-amber-500/10 rounded-full" />
                            <div className="space-y-1">
                                <div className="h-3 w-12 bg-card rounded" />
                                <div className="h-4 w-32 bg-card rounded-lg" />
                                <div className="h-3 w-40 bg-card rounded-lg mt-2" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
                            <div className="h-4 w-20 bg-primary/20 rounded" />
                            <div className="h-8 w-36 bg-card rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
