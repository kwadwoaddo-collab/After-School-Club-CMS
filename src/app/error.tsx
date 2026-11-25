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
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-page text-text flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2.5 min-h-[44px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg px-2"
                    aria-label="After-School Club CMS · by SprintScale IT"
                >
                    <span className="w-9 h-9 rounded-lg bg-accent text-on-accent inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
                    <span className="flex flex-col leading-tight text-left">
                        <span className="font-bold text-sm text-text">After-School Club CMS</span>
                        <span className="text-xs text-text-muted">by SprintScale IT</span>
                    </span>
                </Link>
            </div>
            <div role="alert" className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-warning-soft flex items-center justify-center mb-5">
                    <AlertTriangle className="w-7 h-7 text-warning" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-text tracking-tight mb-2">Unexpected Application Error</h1>
                <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                    An unexpected system error occurred. We have logged the error details. Please try reloading the page or returning home.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                    <button
                        type="button"
                        onClick={reset}
                        className="min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" aria-hidden="true" />
                        Reload Page
                    </button>
                    <Link
                        href="/"
                        className="min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface-elevated border border-border text-text text-sm font-semibold hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    >
                        <Home className="w-4 h-4" aria-hidden="true" />
                        Back to Home
                    </Link>
                </div>
            </div>
        </main>
    );
}
