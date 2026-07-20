export default function ChildDetailsLoading() {
    return (
        <div className="min-h-screen bg-surface pb-12 animate-pulse">
            <header className="bg-card border-b border-outline-variant/10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex gap-4">
                    <div className="w-10 h-10 bg-secondary rounded-lg" />
                    <div className="flex flex-col gap-2">
                        <div className="w-48 h-6 bg-secondary rounded" />
                        <div className="w-32 h-4 bg-secondary rounded" />
                    </div>
                </div>
            </header>
            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                <div className="h-48 bg-card rounded-2xl" />
                <div className="h-32 bg-card rounded-2xl" />
                <div className="h-64 bg-card rounded-2xl" />
            </main>
        </div>
    );
}
