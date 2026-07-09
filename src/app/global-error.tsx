'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Global Layout Error:', error);
    }, [error]);

    return (
        <html lang="en">
            <body className="min-h-screen bg-[#111216] text-[#e5e2e1] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight mb-2">Critical System Error</h1>
                <p className="text-sm text-[#8c909f] max-w-md mb-8 leading-relaxed">
                    A critical rendering error occurred. Please try refreshing or clearing browser cache.
                </p>
                <button
                    onClick={reset}
                    className="px-6 py-3.5 rounded-2xl bg-[#adc6ff] text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                >
                    Refresh Application
                </button>
            </body>
        </html>
    );
}
