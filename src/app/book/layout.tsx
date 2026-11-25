import { ToastProvider } from '@/components/ui/ToastProvider';

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[var(--if-accent)] focus:text-[var(--if-on-accent)] focus:text-sm focus:font-semibold focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--if-accent)]"
            >
                Skip to main content
            </a>
            <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#05070A' }}>
                <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/8 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 -left-32 w-96 h-96 bg-emerald-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
                <main id="main-content" tabIndex={-1} className="relative z-10 outline-none">
                    {children}
                </main>
            </div>
        </ToastProvider>
    );
}
