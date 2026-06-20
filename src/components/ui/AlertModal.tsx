'use client';

import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: ReactNode;
    buttonText?: string;
    variant?: 'error' | 'success' | 'info';
}

export default function AlertModal({
    isOpen,
    onClose,
    title,
    description,
    buttonText = 'Okay',
    variant = 'error'
}: AlertModalProps) {
    if (!isOpen) return null;

    const Icon = variant === 'error' ? AlertTriangle : variant === 'success' ? CheckCircle2 : Info;
    const iconColor = variant === 'error' ? 'text-error' : variant === 'success' ? 'text-emerald-500' : 'text-blue-500';
    const iconBg = variant === 'error' ? 'bg-error/10 border-error/20' : variant === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-blue-500/10 border-blue-500/20';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface-container-high border border-outline-variant/20 rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 relative">
                <div className={`w-14 h-14 ${iconBg} border rounded-2xl flex items-center justify-center mx-auto mb-5`}>
                    <Icon className={`w-7 h-7 ${iconColor}`} />
                </div>
                <h3 className="text-xl font-black text-white text-center mb-2 tracking-tight">{title}</h3>
                <div className="text-sm text-on-surface-variant text-center mb-6 font-medium">
                    {description}
                </div>
                
                <button
                    onClick={onClose}
                    className="w-full bg-surface-container-highest text-white font-bold py-3.5 rounded-xl hover:bg-surface-container-highest/80 transition-all border border-outline-variant/10 shadow-lg"
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
}
