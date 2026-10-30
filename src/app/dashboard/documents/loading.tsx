export default function DocumentsLoading() {
    return (
        <div className="space-y-6 animate-pulse" role="status" aria-label="Loading documents">
            <div className="flex items-center justify-between">
                <div className="h-8 w-40 bg-secondary rounded-md" />
                <div className="h-9 w-32 bg-secondary rounded-md" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-28 rounded-xl border border-border bg-surface p-4" />
                ))}
            </div>
        </div>
    );
}
