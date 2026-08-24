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

    // V-5 fix: replaced hardcoded dark hex colours (#111216, #17191e, #e5e2e1, #424754,
    // #8c909f) with CMS design-system tokens (bg-surface, bg-card, text-on-surface,
    // text-on-surface-variant, border-outline-variant).
    return (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-between pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <header className="bg-card border-b border-outline-variant/10 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-wider text-on-surface">Parent Portal</span>
                </div>
            </header>

            {/* Error Content */}
            <main className="flex-1 max-w-md mx-auto px-4 flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mb-6 border border-error/20">
                    <AlertCircle className="w-8 h-8 text-error" />
                </div>
                <h2 className="text-2xl font-black text-on-surface tracking-tight mb-2">We hit a snag</h2>
                <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
                    Something went wrong while loading this page. This could be due to a temporary connection issue.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <button
                        onClick={reset}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-primary/10"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reload Page
                    </button>
                    <Link
                        href="/portal"
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-surface-dim border border-outline-variant/20 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-card transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Dashboard
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center text-[10px] text-on-surface-variant px-4">
                If you keep seeing this screen, please contact support at support@sprintscaleit.co.uk
            </footer>
        </div>
    );
}
