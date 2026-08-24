// UX-1 (Milestone 3N): Dashboard-scoped not-found.tsx.
//
// Placed at src/app/dashboard/not-found.tsx so that Next.js resolves this
// component for any 404 originating within /dashboard/** routes (e.g. a user
// navigating to a deleted entity URL or an invalid ID).  Public routes outside
// /dashboard/ are not affected — Next.js will continue to use the nearest
// ancestor not-found handler (the app-level default) for those paths.
//
// Intentionally a Server Component (no 'use client') so it renders inside the
// authenticated dashboard layout shell without an extra client boundary.
//
// Note: the authenticated layout (src/app/dashboard/layout.tsx) wraps all
// dashboard pages; the not-found content inherits the layout shell (sidebar,
// header, etc.) automatically, keeping the user in the authenticated experience.
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
                <SearchX className="size-8 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-text mb-3">Page not found</h1>
            <p className="text-text-muted max-w-md mb-8">
                The page or record you&apos;re looking for doesn&apos;t exist or may have been removed.
            </p>
            <Link
                href="/dashboard"
                className="px-6 py-3 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 transition-colors"
            >
                Back to Dashboard
            </Link>
        </div>
    );
}
