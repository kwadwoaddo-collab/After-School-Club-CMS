export default function ChildDetailsLoading() {
    return (
        <div className="min-h-screen bg-page pb-12 animate-pulse">
            <header className="bg-surface border-b border-border h-[73px]">
                <div className="max-w-3xl mx-auto px-4 h-full flex items-center gap-4">
                    <div className="w-10 h-10 bg-secondary rounded-lg" />
                    <div className="flex flex-col gap-2">
                        <div className="w-48 h-5 bg-secondary rounded" />
                        <div className="w-32 h-3.5 bg-secondary rounded" />
                    </div>
                </div>
            </header>
            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                <div className="h-48 bg-surface border border-border rounded-2xl p-6 space-y-4">
                    <div className="w-40 h-5 bg-secondary rounded" />
                    <div className="w-full h-24 bg-secondary rounded-xl" />
                </div>
                <div className="h-32 bg-surface border border-border rounded-2xl p-6 space-y-3">
                    <div className="w-36 h-5 bg-secondary rounded" />
                    <div className="w-full h-12 bg-secondary rounded-xl" />
                </div>
                <div className="h-64 bg-surface border border-border rounded-2xl p-6 space-y-4">
                    <div className="w-44 h-5 bg-secondary rounded" />
                    <div className="w-full h-36 bg-secondary rounded-xl" />
                </div>
            </main>
        </div>
    );
}
