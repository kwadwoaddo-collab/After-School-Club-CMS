'use client';

import { useMemo, useState, useTransition } from 'react';
import { X, Check, AlertTriangle, FileText, Users, History } from 'lucide-react';
import { penceToPounds, poundsToPence } from '@/lib/billing';
import {
    formatIsoDate,
    getBillingPeriodBySignedIndex,
    getBillingPeriodForDate,
    isHistoricalBillingPeriod,
} from '@/lib/billing/date-engine';
import { generateInvoiceFromConfig } from '@/features/billing/actions';
import type { CoveredChild } from '@/features/billing/queries';

interface Props {
    configId:           string;
    familyName:         string;
    parentEmail:        string;
    coveredChildren:    CoveredChild[];
    amountPence:        number;
    periodLabel:        string;
    invoiceDateStr:     string;  // 'YYYY-MM-DD'
    dueDateStr:         string;
    periodStartStr?:    string | null;
    periodEndStr?:      string | null;
    billingAnchorDate?: string | null;
    onClose:            () => void;
    onSuccess:          () => void;
}

type Step = 'review' | 'success';

interface SelectablePeriod {
    key: string;
    periodStartStr: string;
    periodEndStr: string;
    periodLabel: string;
    isHistorical: boolean;
}

export default function GenerateInvoiceModal({
    configId,
    familyName,
    parentEmail,
    coveredChildren,
    amountPence,
    periodLabel,
    invoiceDateStr,
    dueDateStr,
    periodStartStr,
    periodEndStr,
    billingAnchorDate,
    onClose,
    onSuccess,
}: Props) {
    const defaultStartStr = periodStartStr || dueDateStr;
    const defaultEndStr = periodEndStr || dueDateStr;

    const selectablePeriods = useMemo<SelectablePeriod[]>(() => {
        const now = new Date();
        const options: SelectablePeriod[] = [];
        const seen = new Set<string>();

        if (billingAnchorDate) {
            try {
                const current = getBillingPeriodForDate(billingAnchorDate, now);
                for (let idx = current.periodIndex - 12; idx <= current.periodIndex + 3; idx++) {
                    const p = getBillingPeriodBySignedIndex(billingAnchorDate, idx);
                    const sStr = formatIsoDate(p.periodStart);
                    const eStr = formatIsoDate(p.periodEnd);
                    const key = `${sStr}:${eStr}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        options.push({
                            key,
                            periodStartStr: sStr,
                            periodEndStr: eStr,
                            periodLabel: p.periodLabel,
                            isHistorical: isHistoricalBillingPeriod(eStr, now),
                        });
                    }
                }
            } catch {
                // fallback to default period below
            }
        }

        const defaultKey = `${defaultStartStr}:${defaultEndStr}`;
        if (!seen.has(defaultKey) && defaultStartStr && defaultEndStr) {
            options.unshift({
                key: defaultKey,
                periodStartStr: defaultStartStr,
                periodEndStr: defaultEndStr,
                periodLabel,
                isHistorical: isHistoricalBillingPeriod(defaultEndStr, now),
            });
        }

        return options;
    }, [billingAnchorDate, defaultStartStr, defaultEndStr, periodLabel]);

    const [selectedPeriodKey, setSelectedPeriodKey] = useState(`${defaultStartStr}:${defaultEndStr}`);
    const activePeriod = useMemo(
        () => selectablePeriods.find(p => p.key === selectedPeriodKey) ?? {
            key: `${defaultStartStr}:${defaultEndStr}`,
            periodStartStr: defaultStartStr,
            periodEndStr: defaultEndStr,
            periodLabel,
            isHistorical: isHistoricalBillingPeriod(defaultEndStr, new Date()),
        },
        [selectablePeriods, selectedPeriodKey, defaultStartStr, defaultEndStr, periodLabel],
    );

    const [step, setStep]               = useState<Step>('review');
    const [editedPence, setEditedPence] = useState(amountPence);
    const [editedFee, setEditedFee]     = useState(String(amountPence / 100));
    const [notes, setNotes]             = useState('');
    const [historicalReason, setHistoricalReason] = useState('');
    const [confirmHistorical, setConfirmHistorical] = useState(false);
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

        if (activePeriod.isHistorical) {
            if (!confirmHistorical || historicalReason.trim().length < 3) {
                setError('Historical billing period warning: please confirm historical draft creation and enter an audit reason (at least 3 characters).');
                return;
            }
        }

        start(async () => {
            try {
                const result = await generateInvoiceFromConfig({
                    configId,
                    periodStartStr:    activePeriod.periodStartStr,
                    periodEndStr:      activePeriod.periodEndStr,
                    amountPence:       editedPence,
                    notes:             notes || undefined,
                    confirmHistorical: activePeriod.isHistorical ? confirmHistorical : undefined,
                    historicalReason:  activePeriod.isHistorical ? historicalReason.trim() : undefined,
                });
                setInvoiceId(result.invoiceId);
                setStep('success');
                onSuccess();
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setError(message ?? 'Failed to generate invoice. Please try again.');
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-center">
                            <FileText className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-foreground">Generate Draft Invoice</p>
                            <p className="text-xs text-muted-foreground">{familyName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl hover:bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-muted-foreground transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {step === 'review' && (
                    <div className="px-5 py-4 space-y-4">
                        {/* Period Selector */}
                        {selectablePeriods.length > 1 && (
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                    Billing Period
                                </label>
                                <select
                                    value={selectedPeriodKey}
                                    onChange={(e) => {
                                        setSelectedPeriodKey(e.target.value);
                                        setError('');
                                    }}
                                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    {selectablePeriods.map((p) => (
                                        <option key={p.key} value={p.key}>
                                            {p.periodLabel} ({p.periodStartStr} – {p.periodEndStr}){p.isHistorical ? ' [Historical]' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Period Details */}
                        <div className="bg-secondary/40 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground font-semibold">Period</span>
                                <span className="font-black text-foreground">{activePeriod.periodLabel}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground font-semibold">Draft creation date</span>
                                <span className="font-bold text-foreground">{invoiceDateStr || 'Today'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground font-semibold">Due date</span>
                                <span className="font-bold text-foreground">{activePeriod.periodStartStr}</span>
                            </div>
                        </div>

                        {/* Historical Period Warning & Audit Controls */}
                        {activePeriod.isHistorical && (
                            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                                <div className="flex items-start gap-2">
                                    <History className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                        <p className="font-black uppercase tracking-wider">Historical Billing Period Warning</p>
                                        <p className="font-medium">
                                            This billing period ({activePeriod.periodStartStr} to {activePeriod.periodEndStr}) has already ended. Generating a historical draft is audited and will create a DRAFT only (it will not email the parent until issued separately).
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-1">
                                        Reason for Historical Draft (Required for Audit)
                                    </label>
                                    <input
                                        type="text"
                                        value={historicalReason}
                                        onChange={e => setHistoricalReason(e.target.value)}
                                        placeholder="e.g. Agreed backdated billing after late registration"
                                        className="w-full h-10 px-3 rounded-lg border border-amber-500/40 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                    />
                                </div>
                                <label className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={confirmHistorical}
                                        onChange={e => setConfirmHistorical(e.target.checked)}
                                        className="rounded border-amber-500/40 accent-amber-600 w-4 h-4"
                                    />
                                    I confirm this completed historical period should be generated as a draft.
                                </label>
                            </div>
                        )}

                        {/* Children */}
                        {coveredChildren.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Students Covered</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {coveredChildren.map(c => (
                                        <span
                                            key={c.childId}
                                            className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold flex items-center gap-1"
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
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                Invoice Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">£</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editedFee}
                                    onChange={e => handleFeeChange(e.target.value)}
                                    className="w-full h-12 pl-7 pr-4 rounded-xl border border-border text-foreground font-black text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Agreed fee is {penceToPounds(amountPence)} — adjust if needed for this month.
                            </p>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                Notes (optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                placeholder="e.g. Reduced for bank holiday week"
                                className="w-full px-4 py-3 rounded-xl border border-border text-sm text-foreground font-medium resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>

                        {/* Bill-to info */}
                        <div className="bg-secondary/40 rounded-xl px-4 py-3">
                            <p className="text-xs text-muted-foreground font-semibold">Draft created for (parent notified only upon separate issuance)</p>
                            <p className="text-sm font-bold text-foreground mt-0.5">{familyName}</p>
                            {parentEmail && <p className="text-xs text-muted-foreground">{parentEmail}</p>}
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
                                className="flex-1 h-11 rounded-xl border border-border text-muted-foreground text-sm font-bold hover:bg-secondary/40 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isPending}
                                className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary/90 transition-all disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {isPending ? (
                                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
                                ) : (
                                    <><Check className="w-4 h-4" />Generate Draft</>
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
                            <p className="text-lg font-black text-foreground">Draft Invoice Generated!</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {penceToPounds(editedPence)} draft for {familyName} — {activePeriod.periodLabel}
                            </p>
                        </div>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={onClose}
                                className="px-5 h-10 rounded-xl border border-border text-foreground text-sm font-bold hover:bg-secondary/40 transition-all"
                            >
                                Done
                            </button>
                            {invoiceId && (
                                <a
                                    href={`/dashboard/finance/invoices/${invoiceId}`}
                                    className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary/90 transition-all flex items-center gap-1.5"
                                >
                                    <FileText className="w-4 h-4" />
                                    Review & Issue Draft
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
