'use client';

import './globals.css';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Global Layout Error:', error);
    }, [error]);

    return (
        <html lang="en">
            <head>
                <title>Critical System Error · After-School Club CMS</title>
            </head>
            <body className="min-h-screen bg-page text-text flex flex-col items-center justify-center p-6 text-center">
                <div
                    role="alert"
                    className="max-w-md w-full bg-surface border border-border rounded-xl shadow-sm p-8 flex flex-col items-center"
                >
                    <div className="size-16 rounded-xl bg-danger-soft flex items-center justify-center mb-6">
                        <AlertCircle className="size-8 text-danger" aria-hidden="true" />
                    </div>
                    <h1 className="text-2xl font-bold text-text tracking-tight mb-2">Critical System Error</h1>
                    <p className="text-sm text-text-muted mb-6 leading-relaxed">
                        A critical rendering error occurred. Please try refreshing the application.
                    </p>
                    {error.digest && (
                        <p className="text-xs font-mono text-text-muted mb-6">
                            Reference: {error.digest}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={reset}
                        className="min-h-11 px-6 py-3 rounded-lg bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        Refresh Application
                    </button>
                </div>
            </body>
        </html>
    );
}
