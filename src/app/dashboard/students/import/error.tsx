'use client';
import { useEffect } from 'react';
export default function ImportError({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => { console.error(error); }, [error]);
    return (
        <div className="glassmorphic-card p-8 rounded-3xl text-center max-w-lg mx-auto mt-12">
            <p className="text-destructive font-bold text-lg mb-2">Import failed</p>
            <p className="text-muted-foreground mb-6">{error.message || 'An error occurred while processing your file.'}</p>
            <button onClick={reset} className="px-6 py-3 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-bold rounded-2xl">Try Again</button>
        </div>
    );
}
