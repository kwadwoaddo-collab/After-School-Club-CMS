import { ToastProvider } from '@/components/ui/ToastProvider';
import type { ReactNode } from 'react';

export default function CentrePortalLayout({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[var(--if-accent)] focus:text-[var(--if-on-accent)] focus:text-sm focus:font-semibold focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--if-accent)]"
            >
                Skip to main content
            </a>
            <div className="min-h-screen relative" style={{ backgroundColor: '#05070A' }}>
                <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    <div className="absolute -top-40 -left-40 w-80 h-80 bg-teal-500/8 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
                    <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
                </div>
                <main id="main-content" tabIndex={-1} className="relative z-10 outline-none">
                    {children}
                </main>
            </div>
        </ToastProvider>
    );
}
