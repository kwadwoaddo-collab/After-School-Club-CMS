import { ToastProvider } from '@/components/ui/ToastProvider';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[var(--if-accent)] focus:text-[var(--if-on-accent)] focus:text-sm focus:font-semibold focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--if-accent)]"
            >
                Skip to main content
            </a>
            {children}
        </ToastProvider>
    );
}
