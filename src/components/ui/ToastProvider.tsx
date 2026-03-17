'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    variant: ToastVariant;
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (message: string, variant?: ToastVariant) => void;
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

    const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, message, variant }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, toast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ─── Toast Item ───────────────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
};

const STYLES: Record<ToastVariant, string> = {
    success: 'bg-emerald-600 text-white border-emerald-700',
    error:   'bg-red-600 text-white border-red-700',
    info:    'bg-slate-800 text-white border-slate-900',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    return (
        <div
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold
                        animate-in slide-in-from-top-2 duration-300 ${STYLES[toast.variant]}`}
            style={{ minWidth: 260, maxWidth: 400 }}
        >
            <span className="w-6 h-6 flex items-center justify-center bg-white/20 rounded-full text-xs font-bold flex-shrink-0">
                {ICONS[toast.variant]}
            </span>
            <span className="flex-1">{toast.message}</span>
            <button
                onClick={onDismiss}
                className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0 text-base leading-none"
                aria-label="Dismiss"
            >
                ✕
            </button>
        </div>
    );
}
