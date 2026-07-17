export default function NewBookingLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-9 w-44 bg-secondary rounded-xl" />
                <div className="h-4 w-56 bg-muted/60 rounded-lg" />
            </div>

            {/* Full-width form card */}
            <div className="glassmorphic-card rounded-3xl p-8 space-y-8">
                {/* Section title */}
                <div className="h-5 w-1/4 bg-surface-container-high rounded-xl" />

                {/* Input rows */}
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-4 w-32 bg-muted/60 rounded-lg" />
                        <div className="h-11 w-full bg-secondary rounded-2xl" />
                    </div>
                ))}

                {/* Two side-by-side inputs */}
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-2">
                                <div className="h-4 w-24 bg-muted/60 rounded-lg" />
                            <div className="h-11 w-full bg-secondary rounded-2xl" />
                        </div>
                    ))}
                </div>

                {/* Submit button */}
                <div className="h-12 w-36 bg-primary/20 rounded-2xl" />
            </div>
        </div>
    );
}
