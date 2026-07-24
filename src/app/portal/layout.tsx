import { ToastProvider } from '@/components/ui/ToastProvider';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}
