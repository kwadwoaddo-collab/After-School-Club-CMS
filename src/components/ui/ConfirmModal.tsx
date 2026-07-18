'use client';

import { ReactNode } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const Icon = variant === 'danger' ? Trash2 : AlertCircle;
    const iconColor = variant === 'danger' ? 'text-rose-500' : variant === 'warning' ? 'text-amber-500' : 'text-blue-500';
    const iconBg = variant === 'danger' ? 'bg-rose-500/10 border-rose-500/20' : variant === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-blue-500/10 border-blue-500/20';
    const confirmBtnColor = variant === 'danger' 
        ? 'bg-error text-rose-500-container hover:bg-error/90' 
        : variant === 'warning'
        ? 'bg-amber-500 text-white hover:bg-amber-600'
        : 'bg-blue-500 text-white hover:bg-primary/90';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-outline-variant/20 rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 relative">
                <div className={`w-14 h-14 ${iconBg} border rounded-2xl flex items-center justify-center mx-auto mb-5`}>
                    <Icon className={`w-7 h-7 ${iconColor}`} />
                </div>
                <h3 className="text-xl font-black text-white text-center mb-2 tracking-tight">{title}</h3>
                <div className="text-sm text-on-surface-variant text-center mb-6 font-medium">
                    {description}
                </div>
                
                <div className="flex gap-3 w-full">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-secondary/80 text-white font-bold py-3.5 rounded-xl hover:bg-secondary/80/80 transition-all border border-outline-variant/10"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 font-bold py-3.5 rounded-xl transition-all shadow-lg ${confirmBtnColor}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
