export default function CentreDetailLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-9 w-52 bg-card rounded-xl" />
                    <div className="h-4 w-40 bg-card rounded-lg" />
                </div>
                <div className="h-11 w-28 bg-primary/20 rounded-2xl" />
            </div>

            {/* 2-col grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column – 3 stacked cards */}
                <div className="lg:col-span-2 space-y-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="glassmorphic-card rounded-3xl p-6 space-y-4">
                            <div className="h-5 w-1/3 bg-card rounded-xl" />
                            <div className="space-y-2">
                                <div className="h-4 w-full bg-card rounded-lg" />
                                <div className="h-4 w-5/6 bg-card rounded-lg" />
                                <div className="h-4 w-2/3 bg-card rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right column – 1 tall card */}
                <div className="glassmorphic-card rounded-3xl p-6 space-y-4 min-h-[28rem]">
                    <div className="h-5 w-1/2 bg-card rounded-xl" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-4 w-full bg-card rounded-lg" />
                        ))}
                    </div>
                    <div className="h-10 w-full bg-primary/20 rounded-2xl mt-auto" />
                </div>
            </div>
        </div>
    );
}
