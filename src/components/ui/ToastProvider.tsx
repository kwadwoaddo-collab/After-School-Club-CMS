'use client';

import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
    title: string;
    message?: string;
    variant?: ToastVariant;
}

export interface Toast extends Required<ToastOptions> {
    id: string;
}

interface ToastContextValue {
    toasts: Toast[];
    /** Primary API: toast({ title, message?, variant? }) */
    toast: (options: ToastOptions | string, variant?: ToastVariant) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const toast = useCallback((options: ToastOptions | string, variantArg: ToastVariant = 'info') => {
        // Support legacy string signature: toast('message', 'error')
        const normalized: Omit<Toast, 'id'> =
            typeof options === 'string'
                ? { title: options, message: '', variant: variantArg }
                : { title: options.title, message: options.message ?? '', variant: options.variant ?? 'info' };

        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { ...normalized, id }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, toast }}>
            {children}
            {/* Toast Container — top-right */}
            <div
                className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none items-end"
                role="status"
                aria-live="polite"
                aria-atomic="false"
            >
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    border: string;
    titleClass: string;
}> = {
    success: {
        icon: CheckCircle2,
        iconClass: 'text-emerald-400',
        border: 'border-emerald-500/25',
        titleClass: 'text-emerald-400',
    },
    error: {
        icon: XCircle,
        iconClass: 'text-red-400',
        border: 'border-red-500/25',
        titleClass: 'text-red-400',
    },
    warning: {
        icon: AlertTriangle,
        iconClass: 'text-amber-400',
        border: 'border-amber-500/25',
        titleClass: 'text-amber-400',
    },
    info: {
        icon: Info,
        iconClass: 'text-primary',
        border: 'border-primary/25',
        titleClass: 'text-primary',
    },
};

// ─── Toast Item ───────────────────────────────────────────────────────────────

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    const cfg = VARIANT_CONFIG[t.variant];
    const Icon = cfg.icon;

    return (
        <div
            className={`
                pointer-events-auto w-[340px] max-w-[calc(100vw-2rem)]
                bg-[#1a1d23] border ${cfg.border}
                rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.45)]
                transition-all duration-300
                ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
                overflow-hidden
            `}
            role="alert"
        >
            <div className="flex items-start gap-3 p-4">
                <div className={`flex-shrink-0 mt-0.5 ${cfg.iconClass}`}>
                    <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold leading-snug ${cfg.titleClass}`}>
                        {t.title}
                    </p>
                    {t.message && (
                        <p className="text-[#8c909f] text-xs mt-1 leading-relaxed">
                            {t.message}
                        </p>
                    )}
                </div>

                <button
                    onClick={onDismiss}
                    className="flex-shrink-0 p-1 rounded-lg text-[#8c909f] hover:text-white hover:bg-card/5 transition-all"
                    aria-label="Dismiss notification"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Auto-dismiss progress bar */}
            <ProgressBar duration={4000} />
        </div>
    );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ duration }: { duration: number }) {
    const [width, setWidth] = useState(100);

    useEffect(() => {
        const start = performance.now();
        let raf: number;

        const step = (now: number) => {
            const elapsed = now - start;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setWidth(remaining);
            if (remaining > 0) raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [duration]);

    return (
        <div className="h-0.5 bg-card/5 w-full">
            <div
                className="h-full bg-card/20"
                style={{ width: `${width}%`, transition: 'none' }}
            />
        </div>
    );
}
