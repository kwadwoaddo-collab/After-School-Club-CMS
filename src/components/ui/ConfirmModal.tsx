'use client';

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { useDialogFocusTrap } from './useDialogFocusTrap';

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
    const dialogRef = useRef<HTMLDivElement>(null);
    const busy = isLoading || internalLoading;

    const handleClose = useCallback(() => {
        if (busy) return;
        const closeFn = onClose ?? onCancel;
        closeFn?.();
    }, [busy, onClose, onCancel]);

    const content = description ?? message;

    useDialogFocusTrap(isOpen, dialogRef, handleClose);

    if (!isOpen) return null;

    const DefaultIcon = variant === 'danger' ? Trash2 : AlertCircle;
    const iconColor = variant === 'danger' ? 'text-danger' : variant === 'warning' ? 'text-warning' : 'text-info';
    const iconBg = variant === 'danger' ? 'bg-danger-soft border-danger/20' : variant === 'warning' ? 'bg-warning-soft border-warning/20' : 'bg-info-soft border-info/20';
    const confirmBtnColor = variant === 'danger'
        ? 'bg-danger text-on-danger hover:opacity-90'
        : variant === 'warning'
        ? 'bg-amber-600 text-white hover:bg-amber-700'
        : 'bg-accent text-on-accent hover:bg-accent-hover';

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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 relative text-text">
                <button
                    type="button"
                    onClick={handleClose}
                    disabled={busy}
                    aria-label="Close modal"
                    className="absolute top-5 right-5 w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center text-text-muted hover:text-text hover:bg-page transition-all disabled:opacity-50"
                >
                    <X className="w-4 h-4" aria-hidden="true" />
                </button>
                <div className={`w-14 h-14 ${iconBg} border rounded-2xl flex items-center justify-center mx-auto mb-5`}>
                    {icon ?? <DefaultIcon className={`w-7 h-7 ${iconColor}`} />}
                </div>
                <h3 id="confirm-modal-title" className="text-xl font-bold text-text text-center mb-2 tracking-tight">{title}</h3>
                <div className="text-sm text-text-muted text-center mb-6 font-medium">
                    {content}
                </div>

                {error && (
                    <div role="alert" className="flex items-start gap-3 bg-danger-soft border border-danger/20 rounded-xl p-4 mb-6 text-left">
                        <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" aria-hidden="true" />
                        <p className="text-sm font-bold text-danger">{error}</p>
                    </div>
                )}

                <div className="flex gap-3 w-full">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={busy}
                        className="flex-1 bg-surface text-text font-bold py-3.5 rounded-xl hover:bg-surface-elevated transition-all border border-border disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmClick}
                        disabled={busy}
                        className={`flex-1 font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 ${confirmBtnColor}`}
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading" /> : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;
