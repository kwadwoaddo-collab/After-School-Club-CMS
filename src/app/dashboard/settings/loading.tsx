export default function SettingsLoading() {
    return (
        <div className="space-y-8 animate-pulse max-w-3xl">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-9 w-36 bg-card rounded-xl" />
                <div className="h-4 w-64 bg-card rounded-lg" />
            </div>

            {/* Settings sections */}
            {[1, 2, 3].map((i) => (
                <div key={i} className="glassmorphic-card rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-outline-variant/10">
                        <div className="h-5 w-40 bg-card rounded-lg" />
                    </div>
                    <div className="p-6 space-y-6">
                        {[1, 2].map((j) => (
                            <div key={j} className="space-y-2">
                                <div className="h-3 w-24 bg-card rounded" />
                                <div className="h-10 bg-card rounded-xl" />
                            </div>
                        ))}
                        <div className="flex justify-end pt-2">
                            <div className="h-10 w-24 bg-primary/20 rounded-xl" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
