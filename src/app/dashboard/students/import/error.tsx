'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { IMPORT_OUTCOME_UNCONFIRMED } from '@/features/students/import-errors';
import { logger } from '@/lib/logger';
export default function ImportError({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => { logger.error('Import failed', error); }, [error]);
    return (
        <div className="glassmorphic-card p-8 rounded-3xl text-center max-w-lg mx-auto mt-12">
            <p className="text-destructive font-bold text-lg mb-2">Import result needs checking</p>
            <p className="text-muted-foreground mb-6">{IMPORT_OUTCOME_UNCONFIRMED}</p>
            <p className="mb-4"><Link href="/dashboard/students" className="text-primary underline">Check Students</Link>{' · '}<Link href="/dashboard/parents" className="text-primary underline">Check Parents</Link></p>
            <button onClick={reset} className="px-6 py-3 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-bold rounded-2xl">Reload import page</button>
        </div>
    );
}
