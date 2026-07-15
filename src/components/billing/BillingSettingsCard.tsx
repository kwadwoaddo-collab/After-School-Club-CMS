'use client';

import { useState, useTransition } from 'react';
import { PoundSterling, Calendar, Users, ChevronDown, ChevronUp, Pencil, X, Check, Pause, Play, AlertTriangle } from 'lucide-react';
import { penceToPounds, poundsToPence, previewBillingPeriods } from '@/lib/billing';
import {
    createBillingConfig,
    updateBillingConfig,
    pauseBillingConfig,
    resumeBillingConfig,
    cancelBillingConfig,
    addChildToConfig,
    removeChildFromConfig,
} from '@/features/billing/actions';
import type { StudentBillingConfig, CoveredChild } from '@/features/billing/queries';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sibling {
    id:        string;
    firstName: string;
    lastName:  string;
}

interface Props {
    // The student this card is on
    childId:  string;
    parentId: string;
    centreId: string;
    orgId:    string;

    // All siblings at the same centre (for the coverage checkboxes)
    siblings: Sibling[];

    // Existing config if one already exists
    existingConfig: StudentBillingConfig | null;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'active' | 'paused' | 'cancelled' }) {
    const map = {
        active:    { label: 'Active',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        paused:    { label: 'Paused',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border-red-200' },
    };
    const { label, cls } = map[status];
    return (
        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${cls}`}>
            {label}
        </span>
    );
}

// ─── Collapsed view ───────────────────────────────────────────────────────────

function CollapsedView({
    config,
    onEdit,
}: {
    config: StudentBillingConfig;
    onEdit: () => void;
}) {
    const preview = previewBillingPeriods(new Date(config.billingAnchorDate), 1);

    return (
        <div className="space-y-3">
            {/* Fee + status row */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">
                        {penceToPounds(config.agreedMonthlyPence)}
                        <span className="text-sm font-semibold text-gray-400 ml-1">/month</span>
                    </p>
                    {preview[0] && (
                        <p className="text-xs text-gray-400 font-medium mt-0.5">{preview[0]}</p>
                    )}
                </div>
                <StatusBadge status={config.status} />
            </div>

            {/* Children covered — labelled so staff knows it's shared across siblings */}
            {config.coveredChildren.length > 0 && (
                <div>
                    {config.coveredChildren.length > 1 && (
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                            Shared family billing — {config.coveredChildren.length} children
                        </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        {config.coveredChildren.map(c => (
                            <span
                                key={c.childId}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold"
                            >
                                {c.childName}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {config.notes && (
                <p className="text-xs text-gray-400 italic">{config.notes}</p>
            )}

            {/* Edit button */}
            <button
                onClick={onEdit}
                className="w-full h-9 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
            >
                <Pencil className="w-3.5 h-3.5" />
                Edit billing settings
            </button>
        </div>
    );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

function EditForm({
    childId,
    parentId,
    centreId,
    orgId,
    siblings,
    existingConfig,
    onCancel,
    onSaved,
}: Props & { onCancel: () => void; onSaved: () => void }) {
    const isNew = !existingConfig;

    const [fee, setFee]                 = useState(existingConfig ? String(existingConfig.agreedMonthlyPence / 100) : '');
    const [anchorDate, setAnchorDate]   = useState(existingConfig?.billingAnchorDate ?? '');
    const [leadDays, setLeadDays]       = useState(existingConfig?.invoiceLeadDays ?? 7);
    const [notes, setNotes]             = useState(existingConfig?.notes ?? '');
    const [selectedChildIds, setSelected] = useState<Set<string>>(
        // If config exists, use its covered children.
        // If new setup: pre-select ALL siblings at this centre — siblings registered together should all be covered.
        new Set(existingConfig?.coveredChildren.map(c => c.childId) ?? siblings.map(s => s.id))
    );

    const [error, setError]   = useState('');
    const [isPending, start]  = useTransition();

    // Live period preview
    const periodPreview = anchorDate
        ? previewBillingPeriods(new Date(anchorDate), 2)
        : [];

    const toggleChild = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });
    };

    const handleSave = () => {
        setError('');
        const amountPence = poundsToPence(fee);
        if (!amountPence || amountPence <= 0) { setError('Please enter a valid monthly fee'); return; }
        if (!anchorDate) { setError('Please select a billing start date'); return; }
        if (selectedChildIds.size === 0) { setError('Please select at least one child'); return; }

        start(async () => {
            try {
                if (isNew) {
                    await createBillingConfig({
                        parentId,
                        centreId,
                        agreedMonthlyPence: amountPence,
                        billingAnchorDate:  anchorDate,
                        invoiceLeadDays:    leadDays,
                        notes:              notes || undefined,
                        childIds:           [...selectedChildIds],
                    });
                } else {
                    // Update the fee / dates
                    await updateBillingConfig(existingConfig!.id, {
                        agreedMonthlyPence: amountPence,
                        billingAnchorDate:  anchorDate,
                        invoiceLeadDays:    leadDays,
                        notes:              notes || undefined,
                    });
                    // Sync children — add new ones, remove removed ones
                    const current  = new Set(existingConfig!.coveredChildren.map(c => c.childId));
                    const toAdd    = [...selectedChildIds].filter(id => !current.has(id));
                    const toRemove = [...current].filter(id => !selectedChildIds.has(id));
                    await Promise.all([
                        ...toAdd.map(id    => addChildToConfig(existingConfig!.id, id)),
                        ...toRemove.map(id => removeChildFromConfig(existingConfig!.id, id)),
                    ]);
                }
                onSaved();
            } catch (e: any) {
                setError(e.message ?? 'Something went wrong. Please try again.');
            }
        });
    };

    // Sort: current child first, then others. siblings already includes the current child.
    const allSiblings = [
        ...siblings.filter(s => s.id === childId),   // current child first
        ...siblings.filter(s => s.id !== childId),   // then other siblings
    ];

    return (
        <div className="space-y-4">
            {/* Monthly fee */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Agreed Monthly Fee
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">£</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fee}
                        onChange={e => setFee(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-11 pl-7 pr-4 rounded-xl border border-gray-200 text-gray-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Billing start date */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    First Billing Date
                </label>
                <input
                    type="date"
                    value={anchorDate}
                    onChange={e => setAnchorDate(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-gray-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {periodPreview.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {periodPreview.map((p, i) => (
                            <p key={i} className="text-[11px] text-blue-600 font-semibold">
                                {i === 0 ? '→ Next: ' : '→ Then: '}{p}
                            </p>
                        ))}
                    </div>
                )}
            </div>

            {/* Invoice lead days */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Invoice Lead Time
                </label>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        min="1"
                        max="30"
                        value={leadDays}
                        onChange={e => setLeadDays(Number(e.target.value))}
                        className="w-20 h-11 px-3 rounded-xl border border-gray-200 text-gray-900 font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500 font-semibold">days before period start</span>
                </div>
            </div>

            {/* Children covered */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Children Covered
                </label>
                <div className="space-y-2">
                    {allSiblings.map(s => (
                        <label
                            key={s.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                selectedChildIds.has(s.id)
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedChildIds.has(s.id)}
                                onChange={() => toggleChild(s.id)}
                                className="w-4 h-4 rounded accent-blue-600"
                            />
                            <span className={`text-sm font-bold ${selectedChildIds.has(s.id) ? 'text-blue-700' : 'text-gray-700'}`}>
                                {s.firstName} {s.lastName}
                            </span>
                        </label>
                    ))}
                </div>
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
                    placeholder="Any special agreements or notes..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 font-semibold">{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    onClick={onCancel}
                    disabled={isPending}
                    className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-all disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {isPending ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                    ) : (
                        <><Check className="w-4 h-4" />{isNew ? 'Set Up Billing' : 'Save Changes'}</>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── Pause / Cancel controls ──────────────────────────────────────────────────

function StatusControls({ config, onDone }: { config: StudentBillingConfig; onDone: () => void }) {
    const [isPending, start] = useTransition();

    const handlePause = () => start(async () => {
        await pauseBillingConfig(config.id);
        onDone();
    });
    const handleResume = () => start(async () => {
        await resumeBillingConfig(config.id);
        onDone();
    });
    const handleCancel = () => {
        if (!confirm('Cancel billing for this family? This cannot be undone easily.')) return;
        start(async () => {
            await cancelBillingConfig(config.id);
            onDone();
        });
    };

    return (
        <div className="flex gap-2 pt-2">
            {config.status === 'active' ? (
                <button
                    onClick={handlePause}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50 transition-all disabled:opacity-50"
                >
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                </button>
            ) : config.status === 'paused' ? (
                <button
                    onClick={handleResume}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition-all disabled:opacity-50"
                >
                    <Play className="w-3.5 h-3.5" />
                    Resume
                </button>
            ) : null}
            {config.status !== 'cancelled' && (
                <button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                </button>
            )}
        </div>
    );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function BillingSettingsCard({
    childId,
    parentId,
    centreId,
    orgId,
    siblings,
    existingConfig,
}: Props) {
    const [isEditing, setIsEditing] = useState(false);

    const handleSaved = () => {
        setIsEditing(false);
        // Page will revalidate via server action's revalidatePath
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center">
                        <PoundSterling className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-gray-900">Billing</p>
                        <p className="text-[11px] text-gray-400 font-semibold">Family billing settings</p>
                    </div>
                </div>
                {existingConfig && !isEditing && (
                    <StatusBadge status={existingConfig.status} />
                )}
            </div>

            <div className="mx-4 border-t border-gray-100" />

            {/* Body */}
            <div className="px-4 py-4">
                {isEditing ? (
                    <EditForm
                        childId={childId}
                        parentId={parentId}
                        centreId={centreId}
                        orgId={orgId}
                        siblings={siblings}
                        existingConfig={existingConfig}
                        onCancel={() => setIsEditing(false)}
                        onSaved={handleSaved}
                    />
                ) : existingConfig ? (
                    <>
                        <CollapsedView config={existingConfig} onEdit={() => setIsEditing(true)} />
                        <StatusControls config={existingConfig} onDone={handleSaved} />
                    </>
                ) : (
                    <div className="text-center py-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
                            <PoundSterling className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm font-bold text-gray-600 mb-0.5">No billing set up</p>
                        <p className="text-xs text-gray-400 mb-3">Set an agreed monthly fee for this family</p>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full h-10 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <PoundSterling className="w-4 h-4" />
                            Set Up Family Billing
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
