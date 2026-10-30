export default function ReceiptGeneratorLoading() {
    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse" role="status" aria-label="Loading receipt generator">
            <div className="h-8 w-52 bg-secondary rounded-md" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-[480px] rounded-xl border border-border bg-surface p-6" />
                <div className="h-[480px] rounded-xl border border-border bg-surface p-6" />
            </div>
        </div>
    );
}
