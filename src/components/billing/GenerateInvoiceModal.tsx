'use client';

import { useState, useTransition } from 'react';
import { X, Check, AlertTriangle, FileText, Users } from 'lucide-react';
import { penceToPounds, poundsToPence } from '@/lib/billing';
import { generateInvoiceFromConfig } from '@/features/billing/actions';
import type { CoveredChild } from '@/features/billing/queries';

interface Props {
    configId:        string;
    familyName:      string;
    parentEmail:     string;
    coveredChildren: CoveredChild[];
    amountPence:     number;
    periodLabel:     string;
    invoiceDateStr:  string;  // 'YYYY-MM-DD'
    dueDateStr:      string;
    onClose:         () => void;
    onSuccess:       () => void;
}

type Step = 'review' | 'success';

export default function GenerateInvoiceModal({
    configId,
    familyName,
    parentEmail,
    coveredChildren,
    amountPence,
    periodLabel,
    invoiceDateStr,
    dueDateStr,
    onClose,
    onSuccess,
}: Props) {
    const [step, setStep]         = useState<Step>('review');
    const [editedPence, setEditedPence] = useState(amountPence);
    const [editedFee, setEditedFee]     = useState(String(amountPence / 100));
    const [notes, setNotes]             = useState('');
    const [error, setError]             = useState('');
    const [isPending, start]            = useTransition();
    const [invoiceId, setInvoiceId]     = useState('');

    const handleFeeChange = (val: string) => {
        setEditedFee(val);
        const pence = poundsToPence(val);
        if (!isNaN(pence)) setEditedPence(pence);
    };

    const handleGenerate = () => {
        setError('');
        if (!editedPence || editedPence <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        start(async () => {
            try {
                const result = await generateInvoiceFromConfig({
                    configId,
                    periodStartStr: dueDateStr,
                    periodEndStr:   dueDateStr,
                    amountPence:    editedPence,
                    notes:          notes || undefined,
                });
                setInvoiceId(result.invoiceId);
                setStep('success');
                onSuccess();
            } catch (e: any) {
                setError(e.message ?? 'Failed to generate invoice. Please try again.');
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center">
                            <FileText className="w-4.5 h-4.5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-900">Generate Invoice</p>
                            <p className="text-xs text-gray-400">{familyName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {step === 'review' && (
                    <div className="px-5 py-4 space-y-4">
                        {/* Period */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-semibold">Period</span>
                                <span className="font-black text-gray-900">{periodLabel}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-semibold">Invoice date</span>
                                <span className="font-bold text-gray-700">{invoiceDateStr}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-semibold">Due date</span>
                                <span className="font-bold text-gray-700">{dueDateStr}</span>
                            </div>
                        </div>

                        {/* Children */}
                        {coveredChildren.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Students Covered</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {coveredChildren.map(c => (
                                        <span
                                            key={c.childId}
                                            className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1"
                                        >
                                            <Users className="w-3 h-3" />
                                            {c.childName}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Amount — editable */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                Invoice Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">£</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editedFee}
                                    onChange={e => handleFeeChange(e.target.value)}
                                    className="w-full h-12 pl-7 pr-4 rounded-xl border border-gray-200 text-gray-900 font-black text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                                Agreed fee is {penceToPounds(amountPence)} — adjust if needed for this month.
                            </p>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                Notes (optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                placeholder="e.g. Reduced for bank holiday week"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Bill-to info */}
                        <div className="bg-gray-50 rounded-xl px-4 py-3">
                            <p className="text-xs text-gray-400 font-semibold">Invoice will be sent to</p>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{familyName}</p>
                            {parentEmail && <p className="text-xs text-gray-500">{parentEmail}</p>}
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-600 font-semibold">{error}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={onClose}
                                disabled={isPending}
                                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isPending}
                                className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-all disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {isPending ? (
                                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
                                ) : (
                                    <><Check className="w-4 h-4" />Generate Invoice</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="px-5 py-8 text-center space-y-4">
                        <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto">
                            <Check className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-lg font-black text-gray-900">Invoice Generated!</p>
                            <p className="text-sm text-gray-500 mt-1">
                                {penceToPounds(editedPence)} invoice for {familyName} — {periodLabel}
                            </p>
                        </div>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={onClose}
                                className="px-5 h-10 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-all"
                            >
                                Done
                            </button>
                            {invoiceId && (
                                <a
                                    href={`/dashboard/finance/invoices/${invoiceId}`}
                                    className="px-5 h-10 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-all flex items-center gap-1.5"
                                >
                                    <FileText className="w-4 h-4" />
                                    View Invoice
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
