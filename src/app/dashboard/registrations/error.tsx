'use client';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function RegistrationsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Registrations Error:', error);
    }, [error]);

    return (
        <div
            className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-surface border border-border rounded-xl shadow-sm m-4"
            role="alert"
        >
            <div className="size-16 rounded-xl bg-danger-soft flex items-center justify-center mb-6">
                <AlertCircle className="size-8 text-danger" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">Unable to load registrations</h2>
            <p className="text-text-muted max-w-md mb-8">
                We encountered an error loading family registrations. Please try again.
            </p>
            <button
                type="button"
                onClick={reset}
                className="min-h-11 px-6 py-3 rounded-lg bg-accent text-on-accent font-bold hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                Try again
            </button>
        </div>
    );
}
