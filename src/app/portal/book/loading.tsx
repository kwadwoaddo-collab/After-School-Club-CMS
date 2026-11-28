export default function PortalBookLoading() {
    return (
        <div className="min-h-screen bg-page pb-12 animate-pulse">
            <header className="bg-surface border-b border-border h-[73px]">
                <div className="max-w-3xl mx-auto px-4 h-full flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-alt rounded-lg" />
                    <div className="flex flex-col gap-2">
                        <div className="w-40 h-5 bg-surface-alt rounded" />
                        <div className="w-28 h-3.5 bg-surface-alt rounded" />
                    </div>
                </div>
            </header>
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="max-w-2xl mx-auto px-4 space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-surface-alt" />
                        <div className="flex-1 h-1 bg-surface-alt rounded" />
                        <div className="w-8 h-8 rounded-full bg-surface-alt" />
                        <div className="flex-1 h-1 bg-surface-alt rounded" />
                        <div className="w-8 h-8 rounded-full bg-surface-alt" />
                    </div>
                    <div className="h-44 bg-surface border border-border rounded-2xl p-6 space-y-4">
                        <div className="w-48 h-6 bg-surface-alt rounded" />
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="h-20 bg-surface-alt rounded-xl" />
                            <div className="h-20 bg-surface-alt rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
