export default function StaffDetailLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-48 bg-card rounded-xl" />
                    <div className="h-4 w-32 bg-card rounded-lg" />
                </div>
                <div className="h-11 w-28 bg-primary/20 rounded-2xl" />
            </div>

            {/* Profile card: avatar + name */}
            <div className="glassmorphic-card rounded-3xl p-6 flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-card flex-shrink-0" />
                <div className="space-y-2">
                    <div className="h-6 w-44 bg-card rounded-xl" />
                    <div className="h-4 w-28 bg-card rounded-lg" />
                    <div className="h-5 w-20 bg-card rounded-full" />
                </div>
            </div>

            {/* Info rows */}
            <div className="glassmorphic-card rounded-3xl p-6 space-y-5">
                <div className="h-5 w-1/4 bg-card rounded-xl" />
                {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                        <div className="h-4 w-24 bg-card rounded-lg flex-shrink-0" />
                        <div className="h-4 w-56 bg-card rounded-lg" />
                    </div>
                ))}
            </div>
        </div>
    );
}
