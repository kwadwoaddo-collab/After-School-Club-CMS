export default function StaffDetailLoading() {
    return (
        <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
            {/* Back link */}
            <div className="h-4 w-28 bg-page rounded" />

            {/* Header card */}
            <div className="rounded-lg border border-border bg-surface p-5 flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-page flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-5 w-44 bg-page rounded" />
                    <div className="h-4 w-56 bg-page rounded" />
                </div>
            </div>

            {/* Role selector */}
            <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                <div className="h-4 w-1/4 bg-page rounded" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-28 bg-page rounded-md" />
                    ))}
                </div>
            </div>

            {/* Centre assignment */}
            <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
                <div className="h-4 w-1/3 bg-page rounded" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 bg-page rounded-md" />
                    ))}
                </div>
            </div>
        </div>
    );
}
