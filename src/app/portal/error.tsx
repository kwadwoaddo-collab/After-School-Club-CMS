'use client';
import { logger } from '@/lib/logger';

import { useEffect } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function PortalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Parent Portal Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-page text-text flex flex-col justify-between pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <header className="bg-surface border-b border-border sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-wider text-text">Parent Portal</span>
                </div>
            </header>

            {/* Error Content */}
            <main id="main-content" tabIndex={-1} className="flex-1 max-w-md mx-auto px-4 flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mb-6 border border-danger/20">
                    <AlertCircle className="w-8 h-8 text-danger" />
                </div>
                <h2 className="text-2xl font-black text-text tracking-tight mb-2">We hit a snag</h2>
                <p className="text-sm text-text-muted mb-8 leading-relaxed">
                    Something went wrong while loading this page. This could be due to a temporary connection issue.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <button
                        type="button"
                        onClick={reset}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-accent text-on-accent text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-sm cursor-pointer"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reload Page
                    </button>
                    <Link
                        href="/portal"
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-surface-alt border border-border text-text text-xs font-bold uppercase tracking-wider hover:bg-surface transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Dashboard
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center text-xs text-text-muted px-4">
                If you keep seeing this screen, please contact support at support@sprintscaleit.co.uk
            </footer>
        </div>
    );
}
