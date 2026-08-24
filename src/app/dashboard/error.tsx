'use client';
import { logger } from '@/lib/logger';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Dashboard Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-surface border border-border rounded-xl shadow-sm m-4" role="alert">
            <div className="size-16 rounded-xl bg-danger-soft flex items-center justify-center mb-6">
                <AlertCircle className="size-8 text-danger" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">Something went wrong</h2>
            <p className="text-text-muted max-w-md mb-8">
                {error.message || 'We encountered an error loading your dashboard. Please try again.'}
            </p>
            <button
                onClick={reset}
                className="px-6 py-3 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 transition-colors"
            >
                Try again
            </button>
        </div>
    );
}
