export default function InvoicesLoading() {
    return (
        <div className="space-y-6 animate-pulse" role="status" aria-label="Loading invoices">
            <div className="flex items-center justify-between">
                <div className="h-8 w-44 bg-secondary rounded-md" />
                <div className="h-9 w-32 bg-secondary rounded-md" />
            </div>
            <div className="h-12 w-full bg-secondary/60 rounded-lg border border-border" />
            <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                            <div className="h-4 w-48 bg-secondary rounded" />
                            <div className="h-3 w-32 bg-secondary/70 rounded" />
                        </div>
                        <div className="h-5 w-20 bg-secondary rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
