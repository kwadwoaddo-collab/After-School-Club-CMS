export default function ShareLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-9 w-36 bg-surface-container-high rounded-xl" />
                <div className="h-4 w-52 bg-surface-container rounded-lg" />
            </div>

            {/* Single card */}
            <div className="glassmorphic-card rounded-3xl p-8 space-y-6">
                <div className="h-5 w-1/3 bg-surface-container-high rounded-xl" />

                {/* URL display area */}
                <div className="h-14 w-full bg-surface-container-high rounded-2xl" />

                {/* Two buttons */}
                <div className="flex gap-4">
                    <div className="h-11 w-36 bg-primary/20 rounded-2xl" />
                    <div className="h-11 w-36 bg-surface-container-high rounded-2xl" />
                </div>
            </div>
        </div>
    );
}
