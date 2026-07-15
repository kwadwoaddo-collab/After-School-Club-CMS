'use client';

import { useState, useTransition } from 'react';
import { X, ChevronRight, Loader2, CheckCircle2, FileText, Send } from 'lucide-react';
import { generateInvoiceFromConfig } from '@/features/billing/actions';
import { penceToPounds } from '@/lib/billing';

interface Props {
    configId: string;
    childName: string;
    parentName: string;
    parentEmail: string;
    amountPence: number;
    periodLabel: string;
    invoiceDateStr: string;
    dueDateStr: string;
    rateSource: string;
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'review' | 'confirm' | 'success';

export default function GenerateInvoiceModal({
    configId,
    childName,
    parentName,
    parentEmail,
    amountPence,
    periodLabel,
    invoiceDateStr,
    dueDateStr,
    rateSource,
    onClose,
    onSuccess,
}: Props) {
    const [step, setStep]               = useState<Step>('review');
    const [isPending, startTransition]  = useTransition();
    const [createdInvoiceNum, setCreatedInvoiceNum] = useState('');

    // Editable fields on step 1
    const [amount, setAmount]       = useState((amountPence / 100).toFixed(2));
    const [invoiceDate, setInvoiceDate] = useState(invoiceDateStr);
    const [dueDate, setDueDate]     = useState(dueDateStr);
    const [notes, setNotes]         = useState('');
    const [sendEmail, setSendEmail] = useState(false);

    const parsedAmountPence = Math.round(parseFloat(amount) * 100);

    const handleGenerate = () => {
        startTransition(async () => {
            try {
                const invoice = await generateInvoiceFromConfig(configId, {
                    amountPence:  parsedAmountPence,
                    invoiceDate:  invoiceDate,
                    dueDate:      dueDate,
                    notes:        notes || undefined,
                    sendEmail:    sendEmail,
                });
                setCreatedInvoiceNum((invoice as any).invoiceNumber ?? '');
                setStep('success');
            } catch (e: any) {
                alert(e.message ?? 'Failed to generate invoice');
            }
        });
    };

    const labelClass  = 'block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1';
    const inputClass  = 'w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-gray-900">Generate Invoice</h2>
                            <p className="text-xs text-gray-400">{childName} · {periodLabel}</p>
                        </div>
                    </div>
                    {step !== 'success' && (
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Step indicator */}
                {step !== 'success' && (
                    <div className="px-6 py-3 flex items-center gap-2">
                        {(['review', 'confirm'] as const).map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center transition-colors ${
                                    step === s ? 'bg-blue-600 text-white' : 
                                    (s === 'review' && step === 'confirm') ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                                }`}>
                                    {(s === 'review' && step === 'confirm') ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                                </div>
                                <span className={`text-xs font-bold capitalize ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>{s}</span>
                                {i === 0 && <ChevronRight className="w-3 h-3 text-gray-300 mx-1" />}
                            </div>
                        ))}
                    </div>
                )}

                {/* Step 1 — Review */}
                {step === 'review' && (
                    <div className="px-6 pb-6 space-y-4">
                        {/* Summary strip */}
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Student</p>
                                    <p className="font-bold text-gray-900 mt-0.5">{childName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Parent</p>
                                    <p className="font-bold text-gray-900 mt-0.5">{parentName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Period</p>
                                    <p className="font-bold text-gray-900 mt-0.5">{periodLabel}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Rate Source</p>
                                    <p className="font-bold text-gray-700 mt-0.5 capitalize">{rateSource.replace('_', ' ')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Editable amount */}
                        <div>
                            <label className={labelClass}>Invoice Amount</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">£</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className={`${inputClass} pl-7`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Invoice Date</label>
                                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Due Date</label>
                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Notes <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                placeholder="e.g. Half-term reduction applied"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setStep('confirm')}
                            className="w-full h-12 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm shadow-blue-200"
                        >
                            Review & Confirm
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Step 2 — Confirm */}
                {step === 'confirm' && (
                    <div className="px-6 pb-6 space-y-4">
                        {/* Invoice preview card */}
                        <div className="border border-gray-200 rounded-2xl overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Invoice Preview</p>
                            </div>
                            <div className="p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Student</span>
                                    <span className="font-bold text-gray-900">{childName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Period</span>
                                    <span className="font-bold text-gray-900">{periodLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Invoice Date</span>
                                    <span className="font-bold text-gray-900">{invoiceDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Due Date</span>
                                    <span className="font-bold text-gray-900">{dueDate}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-100">
                                    <span className="font-black text-gray-900">Total</span>
                                    <span className="font-black text-xl text-gray-900">{penceToPounds(parsedAmountPence)}</span>
                                </div>
                                {notes && (
                                    <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-2">Note: {notes}</p>
                                )}
                            </div>
                        </div>

                        {/* Send to email */}
                        <label className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="checkbox"
                                checked={sendEmail}
                                onChange={e => setSendEmail(e.target.checked)}
                                className="w-4 h-4 rounded accent-blue-600"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Send className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                    Email to parent
                                </p>
                                <p className="text-xs text-gray-400 truncate">{parentEmail}</p>
                            </div>
                        </label>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('review')}
                                className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-all"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isPending}
                                className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] shadow-sm shadow-blue-200"
                            >
                                {isPending ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                                ) : (
                                    <><FileText className="w-4 h-4" /> Confirm & Generate</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3 — Success */}
                {step === 'success' && (
                    <div className="px-6 pb-8 pt-4 flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900">Invoice Created</h3>
                            {createdInvoiceNum && (
                                <p className="text-sm font-bold text-blue-600 mt-1">{createdInvoiceNum}</p>
                            )}
                            <p className="text-sm text-gray-400 mt-1">
                                {childName} · {periodLabel} · {penceToPounds(parsedAmountPence)}
                            </p>
                            {sendEmail && (
                                <p className="text-xs text-gray-400 mt-0.5">Email sent to {parentEmail}</p>
                            )}
                        </div>
                        <button
                            onClick={() => { onSuccess(); onClose(); }}
                            className="h-12 px-8 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-all active:scale-[0.98] mt-2"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
