// UX-1 (Milestone 3N): Dashboard-scoped not-found.tsx.
import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function DashboardNotFound() {
    return (
        <div
            className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-surface border border-border rounded-xl shadow-sm m-4"
            role="status"
            aria-label="Page not found"
        >
            <div className="size-16 rounded-xl bg-accent-soft flex items-center justify-center mb-6">
                <SearchX className="size-8 text-accent" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-text mb-3">Page not found</h1>
            <p className="text-text-muted max-w-md mb-8">
                The page or record you&apos;re looking for doesn&apos;t exist or may have been removed.
            </p>
            <Link
                href="/dashboard"
                className="min-h-11 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-on-accent font-bold hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                Back to Dashboard
            </Link>
        </div>
    );
}
