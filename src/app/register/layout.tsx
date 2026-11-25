import { ToastProvider } from '@/components/ui/ToastProvider';

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[var(--if-accent)] focus:text-[var(--if-on-accent)] focus:text-sm focus:font-semibold focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--if-accent)]"
            >
                Skip to main content
            </a>
            <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#05070A' }}>
                <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute top-1/2 -right-20 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
                    <div className="absolute -bottom-20 left-1/4 w-64 h-64 bg-cyan-600/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
                </div>
                <main id="main-content" tabIndex={-1} className="relative z-10 outline-none">
                    {children}
                </main>
            </div>
        </ToastProvider>
    );
}
