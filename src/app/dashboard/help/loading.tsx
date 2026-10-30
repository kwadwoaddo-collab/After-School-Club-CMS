export default function HelpLoading() {
    return (
        <div className="space-y-6 animate-pulse" role="status" aria-label="Loading help and training">
            <div className="h-8 w-48 bg-secondary rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-36 rounded-xl border border-border bg-surface p-5" />
                ))}
            </div>
        </div>
    );
}
