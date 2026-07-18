export default function KioskLoading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 animate-pulse">
            {/* Large circle */}
            <div className="w-40 h-40 rounded-full bg-card" />
            {/* Two lines of text */}
            <div className="space-y-3 flex flex-col items-center">
                <div className="h-7 w-64 bg-card rounded-xl" />
                <div className="h-5 w-48 bg-card rounded-lg" />
            </div>
        </div>
    );
}
