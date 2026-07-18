'use client';

import { format } from 'date-fns';
import { useToast } from '@/components/ui/ToastProvider';
import { CreditCard, Landmark, Ticket, HelpCircle, Check, X, Clock, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { verifyPayment, failPayment } from '../actions';

interface Payment {
    id: string;
    amount: string | number;
    method: string;
    status?: string;
    transactionReference: string | null;
    recordedAt: Date | string;
}

interface PaymentHistoryListProps {
    payments: Payment[];
}

export default function PaymentHistoryList({ payments }: PaymentHistoryListProps) {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    if (payments.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center bg-secondary/60 rounded-[32px] border border-dashed border-border">
                <CreditCard className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <h4 className="text-lg font-bold text-foreground">No payments yet</h4>
                <p className="text-sm text-muted-foreground">Payments recorded for this invoice will appear here.</p>
            </div>
        );
    }

    const getMethodIcon = (method: string) => {
        switch (method) {
            case 'bank_transfer': return <Landmark className="w-4 h-4 text-blue-400" />;
            case 'voucher': return <Ticket className="w-4 h-4 text-amber-600" />;
            case 'cash': return <CreditCard className="w-4 h-4 text-emerald-600" />;
            default: return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getMethodLabel = (method: string) => {
        return method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const handleVerify = async (paymentId: string) => {
        setProcessingId(paymentId);
        try {
            const res = await verifyPayment(paymentId);
            if (res.success) {
                toast({ title: 'Success', message: 'Payment verified successfully.', variant: 'success' });
            }
        } catch (e: any) {
            toast({ title: 'Error', message: e.message || 'Failed to verify payment', variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    const handleFail = async (paymentId: string) => {
        setProcessingId(paymentId);
        try {
            const res = await failPayment(paymentId);
            if (res.success) {
                toast({ title: 'Success', message: 'Payment marked as failed.', variant: 'success' });
            }
        } catch (e: any) {
            toast({ title: 'Error', message: e.message || 'Failed to update payment', variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="overflow-hidden bg-card border border-border rounded-[32px]">
            <table className="w-full">
                <thead>
                    <tr className="text-left border-b border-border">
                        <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Method</th>
                        <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Reference</th>
                        <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest text-right">Amount</th>
                        <th className="px-6 py-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {payments.map((payment) => (
                        <tr key={payment.id} className="group hover:bg-secondary/60 transition-colors">
                            <td className="px-6 py-5">
                                <span className="text-sm font-bold text-foreground">
                                    {format(new Date(payment.recordedAt), 'MMM d, yyyy')}
                                </span>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-secondary/60 flex items-center justify-center">
                                        {getMethodIcon(payment.method)}
                                    </div>
                                    <span className="text-sm font-bold text-foreground">
                                        {getMethodLabel(payment.method)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <span className="text-sm font-medium text-muted-foreground">
                                    {payment.transactionReference || '-'}
                                </span>
                            </td>
                            <td className="px-6 py-5">
                                {payment.status === 'pending' ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-xs font-bold ring-1 ring-amber-500/20 w-fit">
                                        <Clock className="w-3.5 h-3.5" /> Pending
                                    </span>
                                ) : payment.status === 'failed' ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 rounded-full text-xs font-bold ring-1 ring-error/20 w-fit">
                                        <AlertCircle className="w-3.5 h-3.5" /> Failed
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold ring-1 ring-emerald-500/20 w-fit">
                                        <Check className="w-3.5 h-3.5" /> Verified
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-5 text-right">
                                <span className={`text-sm font-black ${payment.status === 'failed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    £{Number(payment.amount).toFixed(2)}
                                </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                                {payment.status === 'pending' && (
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => handleVerify(payment.id)}
                                            disabled={processingId === payment.id}
                                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                            title="Verify Payment"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleFail(payment.id)}
                                            disabled={processingId === payment.id}
                                            className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                                            title="Reject Payment"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
