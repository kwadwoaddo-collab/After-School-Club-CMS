'use client';

import { useState, useTransition, useEffect } from 'react';
import {
    CreditCard, ChevronRight, Check, Loader2, X, AlertTriangle, Pencil,
    CircleDot, Pause, Ban
} from 'lucide-react';
import {
    createBillingConfig,
    updateBillingConfig,
    pauseBillingConfig,
    resumeBillingConfig,
    cancelBillingConfig,
} from '@/features/billing/actions';
import { previewUcPeriods, penceToPounds, DEFAULT_NON_UC_RATES } from '@/lib/billing';
import { useToast } from '@/components/ui/ToastProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingConfig {
    id: string;
    billingType: 'non_uc' | 'uc';
    sessionsPerWeek: number | null;
    agreedRatePence: number | null;
    ucPeriodStartDay: number | null;
    ucAgreedAmountPence: number | null;
    billingAnchorDate: string;
    billingEndDate: string | null;
    invoiceLeadDays: number;
    status: 'active' | 'paused' | 'cancelled';
    notes: string | null;
}

interface Props {
    childId: string;
    parentId: string;
    centreId: string;
    organisationId: string;
    existingConfig: BillingConfig | null;
}

// ─── Session chip selector ────────────────────────────────────────────────────

const SESSION_OPTIONS = [1, 2, 3, 4, 5];

function SessionChips({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {SESSION_OPTIONS.map(s => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onChange(s)}
                    className={`w-12 h-12 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${
                        value === s
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700'
                    }`}
                >
                    {s === 5 ? '5+' : s}
                </button>
            ))}
        </div>
    );
}

// ─── Rate display ─────────────────────────────────────────────────────────────

function defaultRateForSessions(sessions: number): number {
    const row = DEFAULT_NON_UC_RATES.find(r => r.sessionsPerWeek === sessions);
    if (row) return row.monthlyRatePence;
    const max = DEFAULT_NON_UC_RATES[DEFAULT_NON_UC_RATES.length - 1];
    return max.monthlyRatePence + (sessions - max.sessionsPerWeek) * (max.extraSessionRatePence ?? 0);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BillingSettingsCard({ childId, parentId, centreId, organisationId, existingConfig }: Props) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(!existingConfig); // open by default if not configured

    // Form state
    const [billingType, setBillingType]           = useState<'non_uc' | 'uc'>(existingConfig?.billingType ?? 'non_uc');
    const [sessions, setSessions]                 = useState(existingConfig?.sessionsPerWeek ?? 3);
    const [rateOverride, setRateOverride]         = useState(
        existingConfig?.agreedRatePence ? (existingConfig.agreedRatePence / 100).toFixed(2) : ''
    );
    const [ucStartDay, setUcStartDay]             = useState(existingConfig?.ucPeriodStartDay ?? 29);
    const [ucAmount, setUcAmount]                 = useState(
        existingConfig?.ucAgreedAmountPence ? (existingConfig.ucAgreedAmountPence / 100).toFixed(2) : ''
    );
    const [anchorDate, setAnchorDate]             = useState(existingConfig?.billingAnchorDate ?? new Date().toISOString().split('T')[0]);
    const [isActive, setIsActive]                 = useState((existingConfig?.status ?? 'active') === 'active');
    const [notes, setNotes]                       = useState(existingConfig?.notes ?? '');
    const [ucPreview, setUcPreview]               = useState('');

    // Live UC preview
    useEffect(() => {
        if (billingType === 'uc' && ucStartDay >= 1 && ucStartDay <= 31) {
            setUcPreview(previewUcPeriods(ucStartDay, 2));
        }
    }, [billingType, ucStartDay]);

    const autoRate = defaultRateForSessions(sessions);
    const effectiveRatePence = rateOverride ? Math.round(parseFloat(rateOverride) * 100) : autoRate;

    const handleSave = () => {
        startTransition(async () => {
            try {
                const data = {
                    childId:             childId,
                    parentId:            parentId,
                    centreId:            centreId,
                    billingType:         billingType,
                    sessionsPerWeek:     billingType === 'non_uc' ? sessions : null,
                    agreedRatePence:     billingType === 'non_uc' && rateOverride ? Math.round(parseFloat(rateOverride) * 100) : null,
                    ucPeriodStartDay:    billingType === 'uc' ? ucStartDay : null,
                    ucAgreedAmountPence: billingType === 'uc' && ucAmount ? Math.round(parseFloat(ucAmount) * 100) : null,
                    billingAnchorDate:   anchorDate,
                    invoiceLeadDays:     7,
                    notes:               notes || null,
                };

                if (existingConfig) {
                    await updateBillingConfig(existingConfig.id, data);
                    if (existingConfig.status === 'active' && !isActive) {
                        await pauseBillingConfig(existingConfig.id);
                    } else if (existingConfig.status === 'paused' && isActive) {
                        await resumeBillingConfig(existingConfig.id);
                    }
                } else {
                    await createBillingConfig(data);
                }

                toast({ title: 'Billing settings saved', variant: 'success' });
                setIsEditing(false);
            } catch (e: any) {
                toast({ title: 'Could not save billing settings', message: e.message, variant: 'error' });
            }
        });
    };

    // ── Collapsed view ────────────────────────────────────────────────────────

    if (!isEditing && existingConfig) {
        const isUc = existingConfig.billingType === 'uc';
        const ratePence = existingConfig.agreedRatePence
            ? existingConfig.agreedRatePence
            : existingConfig.sessionsPerWeek
            ? defaultRateForSessions(existingConfig.sessionsPerWeek)
            : existingConfig.ucAgreedAmountPence ?? 0;

        return (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-bold text-gray-900 text-sm">Billing Settings</span>
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors py-2 px-3 rounded-xl hover:bg-blue-50"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="px-5 pb-4 space-y-1 border-t border-gray-100 pt-3">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Type</p>
                            <p className="text-gray-900 font-semibold">
                                {isUc ? 'UC (Universal Credit)' : `Non-UC · ${existingConfig.sessionsPerWeek} sessions/week`}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Monthly Rate</p>
                            <p className="text-gray-900 font-black text-base">{penceToPounds(ratePence)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Billing Start</p>
                            <p className="text-gray-900 font-semibold">{existingConfig.billingAnchorDate}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${existingConfig.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className={`text-sm font-bold capitalize ${existingConfig.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {existingConfig.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    {existingConfig.notes && (
                        <p className="text-xs text-gray-400 italic pt-1">"{existingConfig.notes}"</p>
                    )}
                </div>
            </div>
        );
    }

    // ── Unconfigured state ────────────────────────────────────────────────────

    if (!isEditing && !existingConfig) {
        return (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                            <span className="font-bold text-gray-900 text-sm">Billing Settings</span>
                            <p className="text-xs text-gray-400">No billing configured yet</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors py-2 px-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100"
                    >
                        Set up billing
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    // ── Edit form (inline) ────────────────────────────────────────────────────

    const inputClass = 'w-full h-11 px-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors';
    const labelClass = 'block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5';

    return (
        <div className="bg-white rounded-2xl border border-blue-300 shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-bold text-gray-900 text-sm">Billing Settings</span>
                </div>
                <div className="flex gap-2">
                    {existingConfig && (
                        <button
                            onClick={() => setIsEditing(false)}
                            className="h-9 px-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-all"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="h-9 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-60 active:scale-95"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Save
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-5">
                {/* Funding type segmented control */}
                <div>
                    <label className={labelClass}>Funding Type</label>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50 p-1 gap-1">
                        {(['non_uc', 'uc'] as const).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setBillingType(t)}
                                className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${
                                    billingType === t
                                        ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {t === 'non_uc' ? 'Non-UC' : 'Universal Credit (UC)'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Non-UC panel */}
                {billingType === 'non_uc' && (
                    <>
                        <div>
                            <label className={labelClass}>Sessions per Week</label>
                            <SessionChips value={sessions} onChange={setSessions} />
                        </div>

                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Auto-calculated Rate</p>
                            <p className="text-gray-900 font-black text-xl">{penceToPounds(autoRate)}<span className="text-sm font-bold text-gray-400"> / month</span></p>
                            <p className="text-xs text-gray-400 mt-0.5">{sessions} session{sessions !== 1 ? 's' : ''}/week · standard rate</p>
                        </div>

                        <div>
                            <label className={labelClass}>Rate Override <span className="text-gray-400 font-normal normal-case">(optional — overrides auto rate)</span></label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">£</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={rateOverride}
                                    onChange={e => setRateOverride(e.target.value)}
                                    placeholder="e.g. 180.00"
                                    className={`${inputClass} pl-7`}
                                />
                                {rateOverride && (
                                    <button
                                        type="button"
                                        onClick={() => setRateOverride('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            {rateOverride && (
                                <p className="text-xs text-amber-600 font-semibold mt-1.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Override active — charged {penceToPounds(effectiveRatePence)}/month instead of {penceToPounds(autoRate)}
                                </p>
                            )}
                        </div>
                    </>
                )}

                {/* UC panel */}
                {billingType === 'uc' && (
                    <>
                        <div>
                            <label className={labelClass}>UC Period Start Day</label>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={ucStartDay}
                                onChange={e => setUcStartDay(parseInt(e.target.value, 10))}
                                className={`${inputClass} max-w-[120px]`}
                            />
                            {ucStartDay > 28 && (
                                <p className="text-xs text-amber-600 font-semibold mt-1.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Day {ucStartDay} doesn't exist in all months — billing will fall back to last day of short months.
                                </p>
                            )}
                            {ucPreview && (
                                <p className="text-xs text-blue-600 font-bold mt-2">
                                    Preview: {ucPreview}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className={labelClass}>Agreed Monthly Amount</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">£</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={ucAmount}
                                    onChange={e => setUcAmount(e.target.value)}
                                    placeholder="e.g. 1800.00"
                                    className={`${inputClass} pl-7`}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">This covers all children for this parent.</p>
                        </div>
                    </>
                )}

                {/* Shared fields */}
                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-100">
                    <div>
                        <label className={labelClass}>Billing Start Date</label>
                        <input
                            type="date"
                            value={anchorDate}
                            onChange={e => setAnchorDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Status</label>
                        <button
                            type="button"
                            onClick={() => setIsActive(v => !v)}
                            className={`h-11 w-full rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                isActive
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                    : 'bg-amber-50 border-amber-300 text-amber-700'
                            }`}
                        >
                            {isActive ? (
                                <><CircleDot className="w-4 h-4" /> Active</>
                            ) : (
                                <><Pause className="w-4 h-4" /> Paused</>
                            )}
                        </button>
                    </div>
                </div>

                <div>
                    <label className={labelClass}>Notes <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        placeholder="e.g. Parent requested paper invoices. Agreed £180 discount from Sep."
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
                    />
                </div>

                {/* Danger zone — cancel billing */}
                {existingConfig && existingConfig.status !== 'cancelled' && (
                    <div className="pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm('Cancel billing for this student? This will stop future invoice generation. You can set up a new config later.')) {
                                    startTransition(async () => {
                                        await cancelBillingConfig(existingConfig.id);
                                        toast({ title: 'Billing cancelled', variant: 'success' });
                                    });
                                }
                            }}
                            className="flex items-center gap-1.5 text-xs text-red-500 font-bold hover:text-red-700 transition-colors"
                        >
                            <Ban className="w-3.5 h-3.5" />
                            Cancel billing for this student
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
