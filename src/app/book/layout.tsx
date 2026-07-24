import { ToastProvider } from '@/components/ui/ToastProvider';

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}
