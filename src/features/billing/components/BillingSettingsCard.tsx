'use client';

import { useState, useTransition } from 'react';
import { PoundSterling, Calendar, Users, ChevronDown, ChevronUp, Pencil, X, Check, Pause, Play, AlertTriangle } from 'lucide-react';
import { penceToPounds, poundsToPence, previewBillingPeriods } from '@/lib/billing';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/Button';
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
// Same soft-token pairing as Badge.tsx / ProgressTimeline — bg-*-soft plus a
// literal color-700/400 text pair with its own dark: variant, since
// --color-success/--color-warning are fixed hexes rather than theme-toggling
// tokens.

function StatusBadge({ status }: { status: 'active' | 'paused' | 'cancelled' }) {
    const map = {
        active:    { label: 'Active',    cls: 'bg-success-soft text-emerald-700 dark:text-emerald-400' },
        paused:    { label: 'Paused',    cls: 'bg-warning-soft text-amber-700 dark:text-amber-400' },
        cancelled: { label: 'Cancelled', cls: 'bg-danger-soft text-danger' },
    };
    const { label, cls } = map[status];
    return (
        <span className={cn('px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider', cls)}>
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
                    <p className="text-financial-total text-text">
                        {penceToPounds(config.agreedMonthlyPence)}
                        <span className="text-small-body font-normal text-text-muted ml-1">/month</span>
                    </p>
                    {preview[0] && (
                        <p className="text-metadata mt-0.5">{preview[0]}</p>
                    )}
                </div>
                <StatusBadge status={config.status} />
            </div>

            {/* Children covered — labelled so staff knows it's shared across siblings */}
            {config.coveredChildren.length > 0 && (
                <div>
                    {config.coveredChildren.length > 1 && (
                        <p className="text-label text-text-muted mb-1.5">
                            Shared family billing — {config.coveredChildren.length} children
                        </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        {config.coveredChildren.map(c => (
                            <span
                                key={c.childId}
                                className="px-2 py-0.5 bg-accent-soft text-accent rounded-sm text-xs font-medium"
                            >
                                {c.childName}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {config.notes && (
                <p className="text-metadata italic">{config.notes}</p>
            )}

            {/* Edit button */}
            <Button variant="outline" size="sm" onClick={onEdit} className="w-full">
                <Pencil className="w-3.5 h-3.5" />
                Edit billing settings
            </Button>
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
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setError(message ?? 'Something went wrong. Please try again.');
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
                <label className="text-label text-text-muted block mb-1.5">
                    Agreed Monthly Fee
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-medium text-small-body">£</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fee}
                        onChange={e => setFee(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-10 pl-7 pr-3 rounded-sm border border-border text-text font-medium text-small-body focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                    />
                </div>
            </div>

            {/* Billing start date */}
            <div>
                <label className="text-label text-text-muted block mb-1.5">
                    First Billing Date
                </label>
                <input
                    type="date"
                    value={anchorDate}
                    onChange={e => setAnchorDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-sm border border-border text-text font-medium text-small-body focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                />
                {periodPreview.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {periodPreview.map((p, i) => (
                            <p key={i} className="text-metadata text-accent">
                                {i === 0 ? '→ Next: ' : '→ Then: '}{p}
                            </p>
                        ))}
                    </div>
                )}
            </div>

            {/* Invoice lead days */}
            <div>
                <label className="text-label text-text-muted block mb-1.5">
                    Invoice Lead Time
                </label>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        min="1"
                        max="30"
                        value={leadDays}
                        onChange={e => setLeadDays(Number(e.target.value))}
                        className="w-20 h-10 px-3 rounded-sm border border-border text-text font-medium text-small-body text-center focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                    />
                    <span className="text-small-body text-text-secondary">days before period start</span>
                </div>
            </div>

            {/* Children covered */}
            <div>
                <label className="text-label text-text-muted block mb-2">
                    Children Covered
                </label>
                <div className="space-y-2">
                    {allSiblings.map(s => (
                        <label
                            key={s.id}
                            className={cn(
                                'flex items-center gap-3 p-2.5 rounded-sm border cursor-pointer transition-colors',
                                selectedChildIds.has(s.id)
                                    ? 'border-accent/40 bg-accent-soft'
                                    : 'border-border-subtle hover:border-border'
                            )}
                        >
                            <input
                                type="checkbox"
                                checked={selectedChildIds.has(s.id)}
                                onChange={() => toggleChild(s.id)}
                                className="w-4 h-4 rounded-sm accent-accent"
                            />
                            <span className={cn('text-small-body font-medium', selectedChildIds.has(s.id) ? 'text-accent' : 'text-text')}>
                                {s.firstName} {s.lastName}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Notes */}
            <div>
                <label className="text-label text-text-muted block mb-1.5">
                    Notes (optional)
                </label>
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Any special agreements or notes..."
                    className="w-full px-3 py-2.5 rounded-sm border border-border text-text text-small-body resize-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                />
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 bg-danger-soft rounded-sm">
                    <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-metadata text-danger">{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <Button variant="secondary" onClick={onCancel} disabled={isPending} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={isPending} className="flex-1">
                    {isPending ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                    ) : (
                        <><Check className="w-4 h-4" />{isNew ? 'Set Up Billing' : 'Save Changes'}</>
                    )}
                </Button>
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
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-border-subtle text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-warning-soft transition-colors disabled:opacity-50"
                >
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                </button>
            ) : config.status === 'paused' ? (
                <button
                    onClick={handleResume}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-border-subtle text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-success-soft transition-colors disabled:opacity-50"
                >
                    <Play className="w-3.5 h-3.5" />
                    Resume
                </button>
            ) : null}
            {config.status !== 'cancelled' && (
                <button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-border-subtle text-danger text-xs font-medium hover:bg-danger-soft transition-colors disabled:opacity-50"
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
        <div className="rounded-md border border-border-subtle bg-surface overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3.5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-accent-soft rounded-sm flex items-center justify-center">
                        <PoundSterling className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                        <p className="text-small-body font-semibold text-text">Billing</p>
                        <p className="text-metadata">Family billing settings</p>
                    </div>
                </div>
                {existingConfig && !isEditing && (
                    <StatusBadge status={existingConfig.status} />
                )}
            </div>

            <div className="border-t border-border-subtle" />

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
                        <div className="w-9 h-9 bg-page rounded-md flex items-center justify-center mx-auto mb-2">
                            <PoundSterling className="w-4 h-4 text-text-muted" />
                        </div>
                        <p className="text-small-body font-semibold text-text mb-0.5">No billing set up</p>
                        <p className="text-metadata mb-3">Set an agreed monthly fee for this family</p>
                        <Button onClick={() => setIsEditing(true)} className="w-full">
                            <PoundSterling className="w-4 h-4" />
                            Set Up Family Billing
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
