export default function FinanceLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-32 bg-surface-container-high rounded-xl" />
                    <div className="h-4 w-48 bg-surface-container rounded-lg" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-32 bg-surface-container-high rounded-2xl" />
                    <div className="h-10 w-32 bg-primary/20 rounded-2xl" />
                </div>
            </div>

            {/* Revenue KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glassmorphic-card rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-8 w-20 bg-surface-container-high rounded-lg" />
                            <div className="h-3 w-24 bg-surface-container rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Invoices table */}
            <div className="glassmorphic-card rounded-2xl overflow-hidden">
                <div className="h-14 bg-surface-container-high/50 border-b border-outline-variant/10 px-6 flex items-center gap-3">
                    <div className="h-4 w-24 bg-surface-container-high rounded" />
                    <div className="ml-auto h-9 w-28 bg-surface-container-high rounded-xl" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-5 border-b border-outline-variant/5">
                        <div className="w-10 h-10 rounded-full bg-surface-container-high flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-40 bg-surface-container-high rounded-lg" />
                            <div className="h-3 w-28 bg-surface-container rounded" />
                        </div>
                        <div className="h-5 w-16 bg-emerald-500/10 rounded-full" />
                        <div className="h-5 w-20 bg-surface-container-high rounded-lg font-mono" />
                    </div>
                ))}
            </div>
        </div>
    );
}
