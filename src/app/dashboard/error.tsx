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
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-card rounded-[32px] border border-outline-variant/10 shadow-xl m-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Something went wrong</h2>
            <p className="text-on-surface-variant max-w-md mb-8">
                {error.message || 'We encountered an error loading your dashboard. Please try again.'}
            </p>
            <button
                onClick={reset}
                className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
                Try again
            </button>
        </div>
    );
}
