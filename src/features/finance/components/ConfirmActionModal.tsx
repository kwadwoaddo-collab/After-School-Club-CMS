'use client';

import { useState } from 'react';
import { X, Trash2, Ban, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    variant: 'delete' | 'void';
    invoiceNumber: string;
    hasPayments?: boolean;
}

export default function ConfirmActionModal({
    isOpen,
    onClose,
    onConfirm,
    variant,
    invoiceNumber,
    hasPayments = false,
}: ConfirmActionModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const isDelete = variant === 'delete';

    const config = isDelete
        ? {
              icon: <Trash2 className="w-6 h-6" />,
              iconBg: 'bg-error/10 text-error border-error/20',
              title: 'Delete Invoice',
              confirmLabel: 'Delete Permanently',
              confirmClass:
                  'bg-error hover:bg-red-700 text-foreground shadow-lg shadow-error/20',
              description: hasPayments
                  ? 'This invoice has recorded payments. Please delete all associated payments first before deleting the invoice.'
                  : `Invoice ${invoiceNumber} will be permanently removed from the database. This action cannot be undone.`,
          }
        : {
              icon: <Ban className="w-6 h-6" />,
              iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              title: 'Void Invoice',
              confirmLabel: 'Void Invoice',
              confirmClass:
                  'bg-amber-500 hover:bg-amber-600 text-foreground shadow-lg shadow-amber-500/20',
              description: `Invoice ${invoiceNumber} will be marked as VOID. All payment records will be preserved for audit purposes, but this invoice will be excluded from revenue reports.`,
          };

    const handleConfirm = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await onConfirm();
            onClose();
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
            <div className="bg-surface-container-high border border-border rounded-[40px] shadow-2xl w-full max-w-md p-10 relative animate-in zoom-in-95 duration-200">
                {/* Close */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-6 right-6 w-9 h-9 rounded-full bg-secondary/60 flex items-center justify-center text-foreground-variant hover:text-foreground hover:bg-secondary transition-all"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon */}
                <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border mb-6 ${config.iconBg}`}
                >
                    {config.icon}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-black text-foreground tracking-tight mb-3">
                    {config.title}
                </h2>

                {/* Description */}
                <p className="text-sm text-foreground-variant leading-relaxed mb-8">
                    {config.description}
                </p>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-3 bg-error/5 border border-error/20 rounded-2xl p-4 mb-6">
                        <AlertTriangle className="w-4 h-4 text-error mt-0.5 shrink-0" />
                        <p className="text-sm font-bold text-error">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3.5 bg-secondary/60 border border-border rounded-2xl text-sm font-bold text-foreground-variant hover:bg-secondary hover:text-foreground transition-all"
                    >
                        Cancel
                    </button>
                    {/* If delete + has payments, only show Cancel */}
                    {!(isDelete && hasPayments) && (
                        <button
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className={`flex-1 py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all disabled:opacity-60 ${config.confirmClass}`}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                config.confirmLabel
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
