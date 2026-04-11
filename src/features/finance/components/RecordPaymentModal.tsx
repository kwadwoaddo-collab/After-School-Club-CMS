'use client';

import { useState } from 'react';
import { X, CreditCard, Calendar, Check, Loader2, Landmark, Ticket } from 'lucide-react';
import { recordPayment } from '../actions';
import { useToast } from '@/components/ui/ToastProvider';

interface RecordPaymentModalProps {
    invoiceId: string;
    invoiceNumber: string;
    remainingBalance: number;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RecordPaymentModal({ 
    invoiceId, 
    invoiceNumber, 
    remainingBalance, 
    onClose, 
    onSuccess 
}: RecordPaymentModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    const [formData, setFormData] = useState({
        amount: remainingBalance.toString(),
        method: 'bank_transfer' as 'cash' | 'bank_transfer' | 'voucher' | 'other',
        recordedAt: new Date().toISOString().split('T')[0],
        reference: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) {
            toast('Please enter a valid positive amount', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await recordPayment({
                invoiceId,
                amount,
                method: formData.method,
                recordedAt: new Date(formData.recordedAt),
                reference: formData.reference
            });
            toast('Payment recorded successfully', 'success');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast(error.message || 'Failed to record payment', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const methods = [
        { id: 'bank_transfer', label: 'Bank Transfer', icon: Landmark, color: 'text-blue-400' },
        { id: 'cash', label: 'Cash', icon: CreditCard, color: 'text-emerald-400' },
        { id: 'voucher', label: 'Voucher', icon: Ticket, color: 'text-amber-400' },
        { id: 'other', label: 'Other', icon: CreditCard, color: 'text-slate-400' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-surface-container-highest border border-outline-variant/20 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/50">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Record Payment</h2>
                        <p className="text-on-surface-variant text-sm font-medium">Reconcile payment for {invoiceNumber}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-on-surface-variant hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            Amount Received (£) <span className="text-primary">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            required
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-3xl font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                        <p className="text-xs text-on-surface-variant font-medium">Remaining Balance: £{remainingBalance.toFixed(2)}</p>
                    </div>

                    {/* Method Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">
                            Payment Method <span className="text-primary">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {methods.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, method: m.id as any })}
                                    className={`relative flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                        formData.method === m.id 
                                        ? 'bg-primary/10 border-primary ring-1 ring-primary' 
                                        : 'bg-surface-container-low border-outline-variant/20 hover:bg-white/5'
                                    }`}
                                >
                                    <m.icon className={`w-5 h-5 ${m.color}`} />
                                    <span className={`text-sm font-bold ${formData.method === m.id ? 'text-white' : 'text-on-surface-variant'}`}>
                                        {m.label}
                                    </span>
                                    {formData.method === m.id && (
                                        <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Received */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" /> Date Received
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.recordedAt}
                            onChange={(e) => setFormData({ ...formData, recordedAt: e.target.value })}
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                        />
                    </div>

                    {/* Reference */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">
                            Transaction Reference
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Bank Ref, Receipt #"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-outline-variant/10 bg-surface-container-high/50 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-white/5 border border-outline-variant/20 rounded-2xl text-sm font-bold text-white hover:bg-white/10 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.amount}
                        className="px-8 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording...</> : 'Record Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
}
