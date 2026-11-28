'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useId, useRef, useCallback } from 'react';
import { X, CreditCard, Calendar, Check, Loader2, Landmark, Ticket, AlertTriangle, RefreshCw } from 'lucide-react';
import { recordPayment } from '../actions';
import { usePaymentIdempotency } from '../hooks/use-payment-idempotency';
import { useToast } from '@/components/ui/ToastProvider';
import { useDialogFocusTrap } from '@/components/ui/useDialogFocusTrap';


const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    card: "Card",
    stripe: "Stripe Online",
    tax_free_childcare: "Tax-Free Childcare",
    childcare_voucher: "Childcare Voucher",
    voucher: "Childcare Voucher",
    other: "Other",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
    verified: "Verified",
    pending: "Pending",
    reversed: "Reversed",
    failed: "Failed",
};

function formatPaymentMethod(method: string | null | undefined): string {
    if (!method) return "Unknown";
    if (PAYMENT_METHOD_LABELS[method]) return PAYMENT_METHOD_LABELS[method];
    return method
        .split("_")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ");
}

function formatPaymentStatus(status: string | null | undefined): string {
    if (!status) return "Unknown";
    if (PAYMENT_STATUS_LABELS[status]) return PAYMENT_STATUS_LABELS[status];
    return status
        .split("_")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ");
}

interface RecordPaymentModalProps {
    invoiceId: string;
    invoiceNumber: string;
    remainingBalance: number;
    invoiceTotal?: number;
    billingContext?: {
        parentId: string;
        familyName: string;
        period: string;
        priorOverdueNotice?: string;
    };
    onClose: () => void;
    onSuccess: () => void;
}

export default function RecordPaymentModal({ 
    invoiceId, 
    invoiceNumber, 
    remainingBalance,
    invoiceTotal,
    billingContext,
    onClose, 
    onSuccess 
}: RecordPaymentModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflictPayment, setConflictPayment] = useState<any | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const fieldId = useId();
    const amountInputId = `${fieldId}-amount`;
    const dateInputId = `${fieldId}-date`;
    const referenceInputId = `${fieldId}-reference`;
    const { toast } = useToast();
    const { idempotencyKey, originalRecordedAt, rotateIdempotencyKey, clearIdempotencyKey } = usePaymentIdempotency(invoiceId);

    const handleEscape = useCallback(() => {
        if (!isSubmitting) onClose();
    }, [isSubmitting, onClose]);

    useDialogFocusTrap(true, dialogRef, handleEscape);

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
            toast(res.isReplay ? 'Payment already recorded (idempotent replay)' : 'Payment recorded. No email sent.', 'success');
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
        { id: 'cash', label: 'Cash', icon: CreditCard, color: 'text-emerald-700 dark:text-emerald-400' },
        { id: 'voucher', label: 'Voucher', icon: Ticket, color: 'text-amber-800 dark:text-amber-300' },
        { id: 'tax_free_childcare', label: 'Tax-Free Childcare', icon: CreditCard, color: 'text-purple-400' },
        { id: 'other', label: 'Other', icon: CreditCard, color: 'text-muted-foreground' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="record-payment-title" className="bg-secondary/80 border border-border rounded-2xl w-full max-w-lg max-h-[90dvh] shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-card/50">
                    <div>
                        <h2 id="record-payment-title" className="text-2xl font-black text-foreground tracking-tight">Record Payment</h2>
                        <p className="text-muted-foreground text-sm font-medium">Record money received for {invoiceNumber}</p>
                        {billingContext && <p className="mt-2 text-sm text-foreground"><a href={`/dashboard/parents/${billingContext.parentId}`} className="text-accent underline">{billingContext.familyName}</a><br />{billingContext.period}</p>}
                    </div>
                    <button 
                        onClick={onClose}
                        aria-label="Close payment form"
                        className="p-2 hover:bg-secondary/60 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {billingContext?.priorOverdueNotice && (
                    <div
                        role="note"
                        className="mx-8 mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
                    >
                        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{billingContext.priorOverdueNotice}</p>
                    </div>
                )}

                {conflictPayment && (
                    <div role="alert" className="mx-8 mt-6 p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl space-y-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                                <p className="font-bold text-amber-950 dark:text-amber-100">Payment Already Recorded With Different Parameters</p>
                                <p>An existing payment was previously recorded under this key:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-amber-900/90 dark:text-amber-200/90">
                                    <li>Amount: £<span className="tabular-nums">{conflictPayment.amount}</span></li>
                                    <li>Method: {formatPaymentMethod(conflictPayment.method)}</li>
                                    <li>Date: <span className="tabular-nums">{conflictPayment.recordedAt ? new Date(conflictPayment.recordedAt).toLocaleDateString('en-GB') : 'N/A'}</span></li>
                                    <li>Status: {formatPaymentStatus(conflictPayment.status)}</li>
                                    {conflictPayment.transactionReference && <li>Reference: {conflictPayment.transactionReference}</li>}
                                </ul>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleStartNewPayment}
                            className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Start a New Payment
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Amount */}
                    <div className="space-y-2">
                        <label htmlFor={amountInputId} className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            Amount Received (£) <span className="text-accent">*</span>
                        </label>
                        <input
                            id={amountInputId}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            required
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-4 text-3xl font-black text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                        />
                        {invoiceTotal !== undefined && <p className="text-xs text-muted-foreground font-medium tabular-nums">Invoice Total: £{invoiceTotal.toFixed(2)}</p>}
                        <p className="text-xs text-muted-foreground font-medium tabular-nums">Remaining Balance: £{remainingBalance.toFixed(2)}</p>
                    </div>

                    {/* Method Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                            Payment Method <span className="text-accent">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {methods.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    aria-pressed={formData.method === m.id}
                                    onClick={() => setFormData({ ...formData, method: m.id as any })}
                                    className={`relative flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                        formData.method === m.id 
                                        ? 'bg-accent/10 border-accent ring-1 ring-accent' 
                                        : 'bg-secondary/40 border-border hover:bg-secondary/60'
                                    }`}
                                >
                                    <m.icon className={`w-5 h-5 ${m.color}`} />
                                    <span className={`text-sm font-bold ${formData.method === m.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        {m.label}
                                    </span>
                                    {formData.method === m.id && (
                                        <Check className="absolute top-2 right-2 w-4 h-4 text-accent" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Received */}
                    <div className="space-y-2">
                        <label htmlFor={dateInputId} className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Date Received
                        </label>
                        <input
                            id={dateInputId}
                            type="date"
                            required
                            value={formData.recordedAt}
                            onChange={(e) => setFormData({ ...formData, recordedAt: e.target.value })}
                            className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-medium tabular-nums"
                        />
                    </div>

                    {/* Reference */}
                    <div className="space-y-2">
                        <label htmlFor={referenceInputId} className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                            Transaction Reference
                        </label>
                        <input
                            id={referenceInputId}
                            type="text"
                            placeholder="e.g. Bank Ref, Receipt #"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-medium"
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
                        className="px-8 py-3 bg-accent rounded-2xl text-sm font-bold text-on-accent hover:opacity-90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording...</> : 'Record Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
}
