import { ToastProvider } from '@/components/ui/ToastProvider';

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#05070A' }}>
                {/* Animated gradient orbs — consistent with login/register/centre-portal */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 -left-32 w-96 h-96 bg-indigo-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        </ToastProvider>
    );
}
