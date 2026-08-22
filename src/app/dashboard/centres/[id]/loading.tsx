export default function CentreDetailLoading() {
    return (
        <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
            {/* Back link */}
            <div className="h-4 w-28 bg-page rounded" />

            {/* Title */}
            <div className="space-y-2">
                <div className="h-6 w-52 bg-page rounded" />
                <div className="h-4 w-32 bg-page rounded" />
            </div>

            {/* Segmented tabs / info banner */}
            <div className="h-9 w-64 bg-page rounded-md border border-border-subtle" />

            {/* Form card */}
            <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 space-y-4">
                <div className="h-4 w-1/4 bg-page rounded" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-9 w-full bg-page rounded-sm" />
                    ))}
                </div>
            </div>
        </div>
    );
}
