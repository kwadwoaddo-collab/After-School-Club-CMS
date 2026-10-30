export default function InvoiceDetailLoading() {
    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse" role="status" aria-label="Loading invoice details">
            <div className="flex items-center justify-between">
                <div className="h-8 w-56 bg-secondary rounded-md" />
                <div className="flex gap-2">
                    <div className="h-9 w-28 bg-secondary rounded-md" />
                    <div className="h-9 w-28 bg-secondary rounded-md" />
                </div>
            </div>
            <div className="h-[520px] rounded-xl border border-border bg-surface p-8 space-y-6">
                <div className="h-6 w-40 bg-secondary rounded" />
                <div className="h-32 w-full bg-secondary/50 rounded-lg" />
                <div className="h-48 w-full bg-secondary/40 rounded-lg" />
            </div>
        </div>
    );
}
