'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { IMPORT_OUTCOME_UNCONFIRMED } from '@/features/students/import-errors';
import { logger } from '@/lib/logger';

export default function ImportError({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => { logger.error('Import failed', error); }, [error]);
    return (
        <main id="main-content" tabIndex={-1} className="py-12 px-4">
            <div role="alert" className="bg-surface border border-border p-8 rounded-2xl shadow-sm text-center max-w-lg mx-auto">
                <div className="mb-4 flex justify-center">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted">
                        <span className="w-6 h-6 rounded-md bg-accent text-on-accent inline-flex items-center justify-center font-bold text-xs" aria-hidden="true">S</span>
                        After-School Club CMS
                    </span>
                </div>
                <h1 className="text-danger font-bold text-lg mb-2">Import result needs checking</h1>
                <p className="text-text-secondary text-sm mb-6">{IMPORT_OUTCOME_UNCONFIRMED}</p>
                <p className="mb-6 text-sm">
                    <Link href="/dashboard/students" className="text-accent font-medium underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">Check Students</Link>
                    {' · '}
                    <Link href="/dashboard/parents" className="text-accent font-medium underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">Check Parents</Link>
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="min-h-[44px] px-6 py-3 bg-accent text-on-accent hover:bg-accent-hover font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    Reload import page
                </button>
            </div>
        </main>
    );
}
