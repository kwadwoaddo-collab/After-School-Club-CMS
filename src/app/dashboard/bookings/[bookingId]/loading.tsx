export default function BookingDetailLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-48 bg-card rounded-xl" />
                    <div className="h-4 w-32 bg-card rounded-lg" />
                </div>
                <div className="flex gap-3">
                    <div className="h-11 w-24 bg-card rounded-2xl" />
                    <div className="h-11 w-24 bg-primary/20 rounded-2xl" />
                </div>
            </div>

            {/* 2-col grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left – booking detail card */}
                <div className="lg:col-span-2 glassmorphic-card rounded-3xl p-6 space-y-5">
                    <div className="h-5 w-1/3 bg-card rounded-xl" />
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="h-4 w-28 bg-card rounded-lg flex-shrink-0" />
                            <div className="h-4 w-48 bg-card rounded-lg" />
                        </div>
                    ))}
                </div>

                {/* Right – status card + attendees */}
                <div className="space-y-6">
                    {/* Status card */}
                    <div className="glassmorphic-card rounded-3xl p-6 space-y-4">
                        <div className="h-5 w-1/2 bg-card rounded-xl" />
                        <div className="h-8 w-24 bg-card rounded-full" />
                        <div className="h-10 w-full bg-primary/20 rounded-2xl" />
                    </div>

                    {/* Attendees list */}
                    <div className="glassmorphic-card rounded-3xl p-6 space-y-4">
                        <div className="h-5 w-1/2 bg-card rounded-xl" />
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-card flex-shrink-0" />
                                <div className="space-y-1 flex-1">
                                    <div className="h-4 w-32 bg-card rounded-lg" />
                                    <div className="h-3 w-20 bg-card rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
