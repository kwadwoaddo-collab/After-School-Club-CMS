'use client';
import { logger } from '@/lib/logger';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Root App Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#111216] text-[#e5e2e1] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Unexpected Application Error</h1>
            <p className="text-sm text-[#8c909f] max-w-md mb-8 leading-relaxed">
                An unexpected system error occurred. We have logged the error details. Please try reloading the page or returning home.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={reset}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reload Page
                </button>
                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
                >
                    <Home className="w-4 h-4" />
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
