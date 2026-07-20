export default function PortalLoading() {
    return (
        <div className="min-h-screen bg-surface pb-12 animate-pulse">
            <div className="h-[200px] bg-secondary/50 rounded-b-3xl" />
            <div className="max-w-4xl mx-auto px-4 -mt-8 space-y-8">
                <div className="h-16 bg-card rounded-xl" />
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="h-32 bg-card rounded-xl" />
                    <div className="h-32 bg-card rounded-xl" />
                    <div className="h-32 bg-card rounded-xl" />
                    <div className="h-32 bg-card rounded-xl" />
                </div>
            </div>
        </div>
    );
}
