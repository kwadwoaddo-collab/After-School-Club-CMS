'use client';

import { format } from 'date-fns';
import { CreditCard, Landmark, Ticket, HelpCircle, Check, X, Clock, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { verifyPayment, failPayment } from '../actions';
import { toast } from 'react-hot-toast';

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

    if (payments.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center bg-white/5 rounded-[32px] border border-dashed border-outline-variant/20">
                <CreditCard className="w-12 h-12 text-on-surface-variant/20 mb-4" />
                <h4 className="text-lg font-bold text-white">No payments yet</h4>
                <p className="text-sm text-on-surface-variant">Payments recorded for this invoice will appear here.</p>
            </div>
        );
    }

    const getMethodIcon = (method: string) => {
        switch (method) {
            case 'bank_transfer': return <Landmark className="w-4 h-4 text-blue-400" />;
            case 'voucher': return <Ticket className="w-4 h-4 text-amber-400" />;
            case 'cash': return <CreditCard className="w-4 h-4 text-emerald-400" />;
            default: return <HelpCircle className="w-4 h-4 text-slate-400" />;
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
                toast.success('Payment verified successfully.');
            }
        } catch (e: any) {
            toast.error(e.message || 'Failed to verify payment');
        } finally {
            setProcessingId(null);
        }
    };

    const handleFail = async (paymentId: string) => {
        setProcessingId(paymentId);
        try {
            const res = await failPayment(paymentId);
            if (res.success) {
                toast.success('Payment marked as failed.');
            }
        } catch (e: any) {
            toast.error(e.message || 'Failed to update payment');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="overflow-hidden bg-surface-container-high border border-outline-variant/10 rounded-[32px]">
            <table className="w-full">
                <thead>
                    <tr className="text-left border-b border-outline-variant/10">
                        <th className="px-6 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">Method</th>
                        <th className="px-6 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">Reference</th>
                        <th className="px-6 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-xs font-black text-on-surface-variant uppercase tracking-widest text-right">Amount</th>
                        <th className="px-6 py-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                    {payments.map((payment) => (
                        <tr key={payment.id} className="group hover:bg-white/5 transition-colors">
                            <td className="px-6 py-5">
                                <span className="text-sm font-bold text-white">
                                    {format(new Date(payment.recordedAt), 'MMM d, yyyy')}
                                </span>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                        {getMethodIcon(payment.method)}
                                    </div>
                                    <span className="text-sm font-bold text-white">
                                        {getMethodLabel(payment.method)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <span className="text-sm font-medium text-on-surface-variant">
                                    {payment.transactionReference || '-'}
                                </span>
                            </td>
                            <td className="px-6 py-5">
                                {payment.status === 'pending' ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold ring-1 ring-amber-500/20 w-fit">
                                        <Clock className="w-3.5 h-3.5" /> Pending
                                    </span>
                                ) : payment.status === 'failed' ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-error/10 text-error rounded-full text-xs font-bold ring-1 ring-error/20 w-fit">
                                        <AlertCircle className="w-3.5 h-3.5" /> Failed
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold ring-1 ring-emerald-500/20 w-fit">
                                        <Check className="w-3.5 h-3.5" /> Verified
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-5 text-right">
                                <span className={`text-sm font-black ${payment.status === 'failed' ? 'text-on-surface-variant line-through' : 'text-white'}`}>
                                    £{Number(payment.amount).toFixed(2)}
                                </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                                {payment.status === 'pending' && (
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => handleVerify(payment.id)}
                                            disabled={processingId === payment.id}
                                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                            title="Verify Payment"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleFail(payment.id)}
                                            disabled={processingId === payment.id}
                                            className="p-2 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
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
