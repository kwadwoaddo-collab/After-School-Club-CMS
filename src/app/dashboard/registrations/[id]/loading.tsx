export default function RegistrationDetailLoading() {
    return (
        <div className="space-y-8 animate-pulse max-w-4xl">
            {/* Back link + header */}
            <div className="space-y-4">
                <div className="h-4 w-32 bg-card rounded" />
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="h-8 w-56 bg-card rounded-xl" />
                        <div className="h-5 w-24 bg-amber-500/10 rounded-full" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-10 w-28 bg-card rounded-xl" />
                        <div className="h-10 w-28 bg-primary/20 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main info */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glassmorphic-card rounded-2xl p-6 space-y-4">
                        <div className="h-5 w-32 bg-card rounded-lg" />
                        <div className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="h-3 w-20 bg-card rounded" />
                                    <div className="h-5 w-36 bg-card rounded-lg" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="glassmorphic-card rounded-2xl p-6 space-y-4">
                        <div className="h-5 w-24 bg-card rounded-lg" />
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-3 bg-card/30 rounded-xl">
                                <div className="w-10 h-10 rounded-full bg-card" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-4 w-32 bg-card rounded" />
                                    <div className="h-3 w-20 bg-card rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar info */}
                <div className="space-y-6">
                    <div className="glassmorphic-card rounded-2xl p-6 space-y-4">
                        <div className="h-5 w-24 bg-card rounded-lg" />
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="h-3 w-16 bg-card rounded" />
                                <div className="h-4 w-28 bg-card rounded" />
                            </div>
                        ))}
                    </div>
                    <div className="glassmorphic-card rounded-2xl p-6 space-y-3">
                        <div className="h-5 w-28 bg-card rounded-lg" />
                        <div className="h-10 bg-card/50 rounded-xl" />
                        <div className="h-10 bg-card/50 rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}
