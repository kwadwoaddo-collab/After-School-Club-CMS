export default function AddStudentLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-9 w-40 bg-card rounded-xl" />
                <div className="h-4 w-52 bg-card rounded-lg" />
            </div>

            {/* Single tall form card */}
            <div className="glassmorphic-card rounded-3xl p-8 space-y-8">
                {/* Section label */}
                <div className="h-5 w-1/4 bg-card rounded-xl" />

                {/* Input rows */}
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-4 w-28 bg-card rounded-lg" />
                        <div className="h-11 w-full bg-card rounded-2xl" />
                    </div>
                ))}

                {/* Two side-by-side fields */}
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-4 w-20 bg-card rounded-lg" />
                            <div className="h-11 w-full bg-card rounded-2xl" />
                        </div>
                    ))}
                </div>

                {/* Submit */}
                <div className="h-12 w-36 bg-primary/20 rounded-2xl" />
            </div>
        </div>
    );
}
