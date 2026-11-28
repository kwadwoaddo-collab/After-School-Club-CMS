export default function PortalLoading() {
    return (
        <div className="min-h-screen bg-page pb-12 animate-pulse">
            <header className="bg-surface border-b border-border h-[73px]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
                    <div className="w-36 h-6 bg-surface-alt rounded" />
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-surface-alt rounded-lg" />
                        <div className="w-20 h-9 bg-surface-alt rounded-lg" />
                    </div>
                </div>
            </header>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
                <div className="h-20 bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                    <div className="w-48 h-5 bg-surface-alt rounded" />
                    <div className="w-28 h-9 bg-surface-alt rounded-lg" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="h-32 bg-surface border border-border rounded-xl p-5 space-y-3">
                        <div className="w-32 h-5 bg-surface-alt rounded" />
                        <div className="w-24 h-4 bg-surface-alt rounded" />
                    </div>
                    <div className="h-32 bg-surface border border-border rounded-xl p-5 space-y-3">
                        <div className="w-32 h-5 bg-surface-alt rounded" />
                        <div className="w-24 h-4 bg-surface-alt rounded" />
                    </div>
                </div>
            </div>
        </div>
    );
}
