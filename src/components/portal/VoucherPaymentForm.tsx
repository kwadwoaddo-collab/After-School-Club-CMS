'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { submitVoucherPayment } from '@/app/portal/billing/actions';
import { CreditCard } from 'lucide-react';

export function VoucherPaymentForm({ invoiceId, amountDue }: { invoiceId: string, amountDue: number }) {
    const [reference, setReference] = useState('');
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reference.trim()) return;

        setIsSubmitting(true);
        const res = await submitVoucherPayment(invoiceId, amountDue, reference);
        setIsSubmitting(false);

        if (res.success) {
            toast({ title: 'Success', message: 'Voucher payment logged. Pending staff verification.', variant: 'success' });
            setReference('');
        } else {
            toast({ title: 'Error', message: res.error || 'Failed to log payment', variant: 'error' });
        }
    };

    if (amountDue <= 0) return null;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <label className="text-xs text-on-surface-variant">Log Childcare Voucher Payment</label>
            <input
                type="text"
                placeholder="Voucher Reference (e.g. Edenred)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
                className="w-full bg-card border border-outline-variant/20 rounded-lg p-2.5 text-sm text-white placeholder:text-on-surface-variant focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button
                type="submit"
                disabled={isSubmitting || !reference.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
            >
                <CreditCard className="w-4 h-4" />
                {isSubmitting ? 'Submitting...' : 'Log Payment'}
            </button>
        </form>
    );
}
