'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose?: () => void;
    onCancel?: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description?: ReactNode;
    message?: ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    icon?: ReactNode;
    isLoading?: boolean;
    error?: ReactNode;
    closeOnConfirm?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onCancel,
    onConfirm,
    title,
    description,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    icon,
    isLoading = false,
    error = null,
    closeOnConfirm = true,
}: ConfirmModalProps) {
    const [internalLoading, setInternalLoading] = useState(false);
    const busy = isLoading || internalLoading;

    const handleClose = useCallback(() => {
        if (busy) return;
        const closeFn = onClose ?? onCancel;
        closeFn?.();
    }, [busy, onClose, onCancel]);

    const content = description ?? message;

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    const DefaultIcon = variant === 'danger' ? Trash2 : AlertCircle;
    const iconColor = variant === 'danger' ? 'text-rose-500' : variant === 'warning' ? 'text-amber-500' : 'text-blue-500';
    const iconBg = variant === 'danger' ? 'bg-rose-500/10 border-rose-500/20' : variant === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-blue-500/10 border-blue-500/20';
    const confirmBtnColor = variant === 'danger'
        ? 'bg-error text-white hover:bg-error/90'
        : variant === 'warning'
        ? 'bg-amber-500 text-white hover:bg-amber-600'
        : 'bg-blue-500 text-white hover:bg-primary/90';

    const handleConfirmClick = async () => {
        if (busy) return;
        const result = onConfirm();
        if (result && typeof (result as Promise<unknown>).then === 'function') {
            setInternalLoading(true);
            try {
                await result;
                if (closeOnConfirm) {
                    const closeFn = onClose ?? onCancel;
                    closeFn?.();
                }
            } finally {
                setInternalLoading(false);
            }
        } else if (closeOnConfirm) {
            handleClose();
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div className="bg-card border border-outline-variant/20 rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 relative">
                <button
                    type="button"
                    onClick={handleClose}
                    disabled={busy}
                    aria-label="Close modal"
                    className="absolute top-5 right-5 w-9 h-9 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
                >
                    <X className="w-4 h-4" aria-hidden="true" />
                </button>
                <div className={`w-14 h-14 ${iconBg} border rounded-2xl flex items-center justify-center mx-auto mb-5`}>
                    {icon ?? <DefaultIcon className={`w-7 h-7 ${iconColor}`} />}
                </div>
                <h3 id="confirm-modal-title" className="text-xl font-black text-foreground text-center mb-2 tracking-tight">{title}</h3>
                <div className="text-sm text-muted-foreground text-center mb-6 font-medium">
                    {content}
                </div>

                {error && (
                    <div role="alert" className="flex items-start gap-3 bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 mb-6 text-left">
                        <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" aria-hidden="true" />
                        <p className="text-sm font-bold text-rose-500">{error}</p>
                    </div>
                )}

                <div className="flex gap-3 w-full">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={busy}
                        className="flex-1 bg-secondary/80 text-foreground font-bold py-3.5 rounded-xl hover:bg-secondary/80 transition-all border border-outline-variant/10 disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmClick}
                        disabled={busy}
                        className={`flex-1 font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${confirmBtnColor}`}
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading" /> : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;
