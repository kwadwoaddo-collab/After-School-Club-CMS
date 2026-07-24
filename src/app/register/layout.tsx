import { ToastProvider } from '@/components/ui/ToastProvider';

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#05070A' }}>
                {/* Animated gradient background orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute top-1/2 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
                    <div className="absolute -bottom-20 left-1/4 w-64 h-64 bg-indigo-600/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
                </div>
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        </ToastProvider>
    );
}
