'use client';
import { logger } from '@/lib/logger';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function KioskError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Kiosk Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-surface border border-border rounded-xl shadow-sm m-4" role="alert">
            <div className="size-16 rounded-xl bg-danger-soft flex items-center justify-center mb-6">
                <AlertCircle className="size-8 text-danger" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">Unable to load kiosk register</h2>
            <p className="text-text-muted max-w-md mb-8">
                We encountered an error loading today&apos;s kiosk register. Please try again to reload the latest session list.
            </p>
            <button
                type="button"
                onClick={reset}
                className="min-h-11 px-6 py-3 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 transition-colors"
            >
                Try again
            </button>
        </div>
    );
}
