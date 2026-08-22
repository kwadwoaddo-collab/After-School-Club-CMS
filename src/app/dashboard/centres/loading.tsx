export default function CentresLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Table */}
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-3 w-16 bg-page rounded" />
                    ))}
                </div>
                <div className="divide-y divide-border-subtle">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="w-8 h-8 rounded-full bg-page flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 w-40 bg-page rounded" />
                                <div className="h-3 w-56 bg-page rounded" />
                            </div>
                            <div className="h-5 w-20 bg-page rounded-sm hidden sm:block" />
                            <div className="h-8 w-28 bg-page rounded hidden md:block" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
