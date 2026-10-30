export default function ReconciliationLoading() {
    return (
        <div className="space-y-6 animate-pulse" role="status" aria-label="Loading payment reconciliation">
            <div className="h-8 w-56 bg-secondary rounded-md" />
            <div className="h-64 rounded-xl border border-border bg-surface p-6" />
        </div>
    );
}
