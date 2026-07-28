export default function AddStudentLoading() {
    return (
        <div className="space-y-6 animate-pulse max-w-2xl mx-auto">
            <div className="h-8 w-48 bg-secondary rounded-xl" />
            <div className="glassmorphic-card p-8 rounded-3xl space-y-4">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="space-y-2">
                        <div className="h-4 w-32 bg-muted/60 rounded-lg" />
                        <div className="h-11 w-full bg-secondary rounded-2xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}
