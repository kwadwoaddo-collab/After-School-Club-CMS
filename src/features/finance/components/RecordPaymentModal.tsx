'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState } from 'react';
import { X, CreditCard, Calendar, Check, Loader2, Landmark, Ticket, AlertTriangle, RefreshCw } from 'lucide-react';
import { recordPayment } from '../actions';
import { usePaymentIdempotency } from '../hooks/use-payment-idempotency';
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
    const [conflictPayment, setConflictPayment] = useState<any | null>(null);
    const { toast } = useToast();
    const { idempotencyKey, originalRecordedAt, rotateIdempotencyKey, clearIdempotencyKey } = usePaymentIdempotency(invoiceId);
    
    const [formData, setFormData] = useState({
        amount: remainingBalance.toString(),
        method: 'bank_transfer' as 'cash' | 'bank_transfer' | 'voucher' | 'other' | 'tax_free_childcare',
        recordedAt: originalRecordedAt ? originalRecordedAt.split('T')[0] : new Date().toISOString().split('T')[0],
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
            const res = await recordPayment({
                invoiceId,
                amount: formData.amount,
                method: formData.method,
                recordedAt: formData.recordedAt,
                transactionReference: formData.reference || undefined,
                idempotencyKey,
                operationMode: 'MANUAL_AMOUNT',
            });

            if (!res.success) {
                if (res.code === 'IDEMPOTENCY_CONFLICT') {
                    setConflictPayment(res.existingPayment || {});
                    toast('Submission conflict: idempotency key was already used with different parameters.', 'error');
                } else {
                    toast(res.error || 'Failed to record payment', 'error');
                    if (res.code === 'FORBIDDEN_ROLE' || res.code === 'FORBIDDEN_CENTRE' || res.code === 'DRAFT_INVOICE' || res.code === 'VOID_INVOICE') {
                        rotateIdempotencyKey();
                    }
                }
                return;
            }

            clearIdempotencyKey();
            toast(res.isReplay ? 'Payment already recorded (idempotent replay)' : 'Payment recorded successfully', 'success');
            onSuccess();
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast(message || 'Failed to record payment', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStartNewPayment = () => {
        rotateIdempotencyKey();
        setConflictPayment(null);
    };

    const methods = [
        { id: 'bank_transfer', label: 'Bank Transfer', icon: Landmark, color: 'text-blue-400' },
        { id: 'cash', label: 'Cash', icon: CreditCard, color: 'text-emerald-600' },
        { id: 'voucher', label: 'Voucher', icon: Ticket, color: 'text-amber-600' },
        { id: 'tax_free_childcare', label: 'Tax-Free Childcare', icon: CreditCard, color: 'text-purple-400' },
        { id: 'other', label: 'Other', icon: CreditCard, color: 'text-muted-foreground' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-secondary/80 border border-border rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-card/50">
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight">Record Payment</h2>
                        <p className="text-muted-foreground text-sm font-medium">Reconcile payment for {invoiceNumber}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-secondary/60 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {conflictPayment && (
                    <div className="mx-8 mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-200/90 space-y-1">
                                <p className="font-bold text-amber-100">Payment Already Recorded With Different Parameters</p>
                                <p>An existing payment was previously recorded under this key:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                    <li>Amount: £{conflictPayment.amount}</li>
                                    <li>Method: {conflictPayment.method}</li>
                                    <li>Date: {conflictPayment.recordedAt ? new Date(conflictPayment.recordedAt).toLocaleDateString('en-GB') : 'N/A'}</li>
                                    <li>Status: {conflictPayment.status}</li>
                                    {conflictPayment.transactionReference && <li>Reference: {conflictPayment.transactionReference}</li>}
                                </ul>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleStartNewPayment}
                            className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Start a New Payment
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            Amount Received (£) <span className="text-primary">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            required
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-4 text-3xl font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                        <p className="text-xs text-muted-foreground font-medium">Remaining Balance: £{remainingBalance.toFixed(2)}</p>
                    </div>

                    {/* Method Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
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
                                        : 'bg-secondary/40 border-border hover:bg-secondary/60'
                                    }`}
                                >
                                    <m.icon className={`w-5 h-5 ${m.color}`} />
                                    <span className={`text-sm font-bold ${formData.method === m.id ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" /> Date Received
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.recordedAt}
                            onChange={(e) => setFormData({ ...formData, recordedAt: e.target.value })}
                            className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                        />
                    </div>

                    {/* Reference */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                            Transaction Reference
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Bank Ref, Receipt #"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-border bg-card/50 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-secondary/60 border border-border rounded-2xl text-sm font-bold text-foreground hover:bg-secondary transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.amount}
                        className="px-8 py-3 bg-primary rounded-2xl text-sm font-bold text-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording...</> : 'Record Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
}
