import { ToastProvider } from '@/components/ui/ToastProvider';

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
                {children}
            </div>
        </ToastProvider>
    );
}
