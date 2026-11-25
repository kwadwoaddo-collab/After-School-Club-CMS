'use client';

import { useState } from 'react';
import { Ban, Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    variant: 'delete' | 'void';
    invoiceNumber: string;
}

export default function ConfirmActionModal({
    isOpen,
    onClose,
    onConfirm,
    variant,
    invoiceNumber,
}: ConfirmActionModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isDelete = variant === 'delete';

    const config = isDelete
        ? {
              icon: <Trash2 className="w-7 h-7 text-rose-500" />,
              title: 'Delete Draft Invoice',
              confirmLabel: 'Discard Permanently',
              modalVariant: 'danger' as const,
              description: `Draft invoice ${invoiceNumber} will be permanently removed from the database. This action cannot be undone.`,
          }
        : {
              icon: <Ban className="w-7 h-7 text-amber-500" />,
              title: 'Void Invoice',
              confirmLabel: 'Void Invoice',
              modalVariant: 'warning' as const,
              description: `Invoice ${invoiceNumber} will be marked as VOID. All payment records will be preserved for audit purposes, but this invoice will be excluded from revenue reports.`,
          };

    const handleClose = () => {
        if (isLoading) return;
        setError(null);
        onClose();
    };

    const handleConfirm = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ConfirmModal
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handleConfirm}
            title={config.title}
            description={config.description}
            confirmText={config.confirmLabel}
            variant={config.modalVariant}
            icon={config.icon}
            isLoading={isLoading}
            error={error}
            closeOnConfirm={false}
        />
    );
}
