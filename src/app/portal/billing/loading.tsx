export default function BillingLoading() {
    return (
        <div className="min-h-screen bg-page pb-12 animate-pulse">
            <header className="bg-surface border-b border-border h-[73px]">
                <div className="max-w-4xl mx-auto px-4 h-full flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-alt rounded-lg" />
                    <div className="flex flex-col gap-2">
                        <div className="w-32 h-5 bg-surface-alt rounded" />
                        <div className="w-24 h-3.5 bg-surface-alt rounded" />
                    </div>
                </div>
            </header>
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                <div className="h-40 bg-surface border border-border rounded-2xl p-6 space-y-4">
                    <div className="w-40 h-5 bg-surface-alt rounded" />
                    <div className="w-28 h-8 bg-surface-alt rounded" />
                </div>
                <div className="h-64 bg-surface border border-border rounded-2xl p-6 space-y-4">
                    <div className="w-48 h-5 bg-surface-alt rounded" />
                    <div className="w-full h-16 bg-surface-alt rounded-xl" />
                    <div className="w-full h-16 bg-surface-alt rounded-xl" />
                </div>
            </div>
        </div>
    );
}
