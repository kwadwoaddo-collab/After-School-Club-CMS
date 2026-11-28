'use client';

import { ReactNode, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useDialogFocusTrap } from './useDialogFocusTrap';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: ReactNode;
    buttonText?: string;
    variant?: 'error' | 'success' | 'info';
}

export function AlertModal({
    isOpen,
    onClose,
    title,
    description,
    buttonText = 'Okay',
    variant = 'error'
}: AlertModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocusTrap(isOpen, dialogRef, onClose);

    if (!isOpen) return null;

    const Icon = variant === 'error' ? AlertTriangle : variant === 'success' ? CheckCircle2 : Info;
    const iconColor = variant === 'error' ? 'text-danger' : variant === 'success' ? 'text-success' : 'text-info';
    const iconBg = variant === 'error' ? 'bg-danger-soft border-danger/20' : variant === 'success' ? 'bg-success-soft border-success/20' : 'bg-info-soft border-info/20';

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-modal-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 relative text-text">
                <div className={`w-14 h-14 ${iconBg} border rounded-2xl flex items-center justify-center mx-auto mb-5`}>
                    <Icon className={`w-7 h-7 ${iconColor}`} />
                </div>
                <h3 id="alert-modal-title" className="text-xl font-bold text-text text-center mb-2 tracking-tight">{title}</h3>
                <div className="text-sm text-text-muted text-center mb-6 font-medium">
                    {description}
                </div>
                
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full bg-surface text-text font-bold py-3.5 rounded-xl hover:bg-surface-elevated transition-all border border-border shadow-sm"
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
}

export default AlertModal;
