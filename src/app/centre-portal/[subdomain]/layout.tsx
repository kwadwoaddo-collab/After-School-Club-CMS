import { ToastProvider } from '@/components/ui/ToastProvider';
import type { ReactNode } from 'react';

export default function CentrePortalLayout({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <div className="min-h-screen relative" style={{ backgroundColor: '#05070A' }}>
                {/* Animated gradient orbs — same premium dark style as login/booking */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute top-1/3 -right-32 w-96 h-96 bg-indigo-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
                    <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
                </div>
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        </ToastProvider>
    );
}
