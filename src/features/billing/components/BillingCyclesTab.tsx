'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CreditCard, AlertCircle, ArrowRight, RefreshCw, Settings2, Users, Loader2 } from 'lucide-react';
import GenerateInvoiceModal from './GenerateInvoiceModal';
import FamilyBillingSummary from './FamilyBillingSummary';
import BulkInvoiceConfirmModal from './BulkInvoiceConfirmModal';
import { useRouter } from 'next/navigation';
import { generateEligibleDraftFromConfig, skipBillingCycle, unskipBillingCycle } from '@/features/billing/actions';
import type { BillingCycleRow } from '@/features/billing/queries';

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: BillingCycleRow['cycleStatus'] }) {
    const map = {
        ready:    { label: 'Draft preparation due',        cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
        draft_due: { label: 'Draft preparation due', cls: 'bg-primary/10 text-primary border-primary/20' },
        draft_review: { label: 'Draft awaiting review', cls: 'bg-primary/10 text-primary border-primary/20' },
        scheduled: { label: 'Scheduled — no action yet', cls: 'bg-secondary/60 text-muted-foreground border-border/50' },
        needs_setup:          { label: 'Needs Setup',          cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
        data_review_required: { label: 'Data Review Required', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
        invoice_sent:         { label: 'Invoice issued',         cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
        paused:       { label: 'Paused',       cls: 'bg-secondary/60 text-muted-foreground border-border/50' },
        skipped:      { label: 'Skipped',      cls: 'bg-muted/60 text-muted-foreground border-border/50' },
    };
    const { label, cls } = map[status];
    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${cls}`}>
            {label}
        </span>
    );
}

// ─── Family billing card ──────────────────────────────────────────────────────

function FamilyBillingCard({ cycle, onGenerated }: { cycle: BillingCycleRow; onGenerated: () => void }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [skipReason, setSkipReason] = useState('');
    const [isSkipping, setIsSkipping] = useState(false);

    const canGenerate = cycle.cycleStatus === 'draft_due' && cycle.config.agreedMonthlyPence > 0;

    const invoiceDateStr = cycle.nextInvoiceDateStr
        ? cycle.nextInvoiceDateStr.split('T')[0]
        : new Date().toISOString().split('T')[0];
    const dueDateStr = cycle.dueDateStr
        ? cycle.dueDateStr.split('T')[0]
        : new Date().toISOString().split('T')[0];

    const periodStartForSkip = cycle.currentPeriodStart || dueDateStr;

    const handleUnskip = async () => {
        setIsSkipping(true);
        try {
            await unskipBillingCycle(cycle.config.id, periodStartForSkip);
            onGenerated();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Failed to unskip cycle');
        } finally {
            setIsSkipping(false);
        }
    };

    const handleSkip = async () => {
        setIsSkipping(true);
        try {
            await skipBillingCycle(cycle.config.id, periodStartForSkip, skipReason || 'Skipped by manager');
            setShowSkipModal(false);
            onGenerated();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Failed to skip cycle');
        } finally {
            setIsSkipping(false);
        }
    };

    return (
        <>
            <div className={`bg-card/80 backdrop-blur-md rounded-3xl border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between ${
                cycle.cycleStatus === 'paused' || cycle.cycleStatus === 'skipped' ? 'opacity-60 border-border/40' :
                cycle.cycleStatus === 'data_review_required' ? 'border-amber-500/40 bg-amber-500/5' :
                cycle.cycleStatus === 'needs_setup' ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/60'
            }`}>
                <div>
                    {/* Card header */}
                    <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <Link
                                href={`/dashboard/parents/${cycle.config.parentId}`}
                                className="text-base font-bold text-foreground hover:text-primary hover:underline transition-colors block truncate tracking-tight"
                            >
                                {cycle.familyName}
                            </Link>
                            {cycle.centreName && (
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">{cycle.centreName}</p>
                            )}
                        </div>
                        <StatusPill status={cycle.cycleStatus} />
                    </div>

                    <div className="mx-5 border-t border-border/50" />

                    {/* Children list */}
                    {cycle.coveredChildren.length > 0 && (
                        <div className="px-5 pt-3 flex flex-wrap gap-1.5">
                            {cycle.coveredChildren.map(c => (
                                <Link
                                    key={c.childId}
                                    href={`/dashboard/students/${c.childId}`}
                                    className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl text-[10px] font-bold transition-colors"
                                >
                                    {c.childName}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Card body */}
                    <div className="px-5 py-3.5 space-y-2 text-sm">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground font-medium">Monthly fee</span>
                            <span className="font-black text-foreground text-lg tracking-tight tabular-nums">{cycle.amountDisplay}</span>
                        </div>
                        {cycle.cycleStatus === 'data_review_required' && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-start gap-1.5 pt-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                Confirm registration and review which children this fee covers before generating another invoice. The agreed family fee has not been changed.
                            </p>
                        )}
                        {cycle.cycleStatus === 'needs_setup' && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5 pt-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                Set a monthly fee on student profile
                            </p>
                        )}
                    </div>
                </div>

                {cycle.familySummary && <FamilyBillingSummary summary={cycle.familySummary} />}
                <div className="px-5 py-3 space-y-2 border-t border-border/50">
                        {cycle.periodLabel && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-medium">Next billing schedule</span>
                                <span className="font-bold text-foreground">{cycle.periodLabel}</span>
                            </div>
                        )}
                        {(cycle.cycleStatus === 'scheduled' || cycle.cycleStatus === 'draft_review') && cycle.nextInvoiceDateStr && <p className="text-sm text-muted-foreground">Draft preparation date for this schedule: {new Date(invoiceDateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}. This is a preparation date, not an invoice issuance deadline.</p>}
                        {cycle.cycleStatus === 'scheduled' && <p className="text-sm text-muted-foreground">No action is needed for this future cycle.</p>}
                        {cycle.cycleStatus === 'draft_review' && <p className="text-sm text-muted-foreground">A draft already exists. Review it before issuing; preparation does not send an invoice or request payment.</p>}
                </div>

                {/* Actions */}
                <div className="px-5 pb-5 pt-2 flex gap-2">
                    <button
                        onClick={() => cycle.coveredChildren[0]
                            ? router.push(`/dashboard/students/${cycle.coveredChildren[0].childId}`)
                            : null
                        }
                        className="flex-1 h-10 rounded-xl bg-secondary/80 text-foreground text-xs font-bold hover:bg-secondary border border-border/50 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        Profile
                    </button>
                    {cycle.cycleStatus === 'skipped' ? (
                        <button
                            disabled={isSkipping}
                            onClick={handleUnskip}
                            className="flex-1 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/20 border border-amber-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                        >
                            {isSkipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Unskip
                        </button>
                    ) : (
                        <>
                            {cycle.cycleStatus === 'draft_due' && (
                                <button
                                    disabled={isSkipping}
                                    onClick={() => setShowSkipModal(true)}
                                    className="px-3 h-10 rounded-xl bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-bold hover:bg-secondary border border-border/50 transition-all active:scale-95"
                                    title="Skip this cycle"
                                >
                                    Skip
                                </button>
                            )}
                            {cycle.cycleStatus === 'draft_review' && cycle.familySummary?.drafts[0] ? <Link href={`/dashboard/finance/invoices/${cycle.familySummary.drafts[0].id}`} className="flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90">Review draft</Link> : <button
                                disabled={!canGenerate}
                                onClick={() => setShowModal(true)}
                                className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                                    canGenerate
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20'
                                        : 'bg-secondary/60 text-muted-foreground cursor-not-allowed'
                                }`}
                            >
                                Prepare draft
                                {canGenerate && <ArrowRight className="w-3.5 h-3.5" />}
                            </button>}
                        </>
                    )}
                </div>
            </div>

            {showSkipModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-foreground">Skip Billing Cycle</h3>
                        <p className="text-sm text-muted-foreground">
                            Skip billing for {cycle.familyName} for period starting {periodStartForSkip}. Any existing draft invoice will be safely discarded.
                        </p>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                Reason for skip
                            </label>
                            <input
                                type="text"
                                value={skipReason}
                                onChange={e => setSkipReason(e.target.value)}
                                placeholder="e.g., Extended family holiday"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                onClick={() => setShowSkipModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={isSkipping}
                                onClick={handleSkip}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                {isSkipping ? 'Skipping...' : 'Confirm Skip'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <GenerateInvoiceModal
                    configId={cycle.config.id}
                    familyName={cycle.familyName}
                    parentEmail={cycle.parentEmail}
                    coveredChildren={cycle.coveredChildren}
                    amountPence={cycle.config.agreedMonthlyPence}
                    periodLabel={cycle.periodLabel}
                    invoiceDateStr={invoiceDateStr}
                    dueDateStr={dueDateStr}
                    periodStartStr={cycle.periodStartStr || cycle.currentPeriodStart}
                    periodEndStr={cycle.periodEndStr}
                    billingAnchorDate={cycle.config.billingAnchorDate}
                    onClose={() => setShowModal(false)}
                    onSuccess={onGenerated}
                />
            )}
        </>
    );
}

// ─── Billing Cycles Tab ───────────────────────────────────────────────────────

interface Props {
    cycles:   BillingCycleRow[];
    centreId: string;
}

export default function BillingCyclesTab({ cycles, centreId }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState<'all' | 'draft_due' | 'draft_review' | 'scheduled' | 'needs_setup' | 'invoice_sent' | 'skipped' | 'data_review_required' | 'paused'>('all');
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    const handleGenerated = () => startTransition(() => router.refresh());

    const handleGenerateAll = async () => {
        setIsGeneratingAll(true);
        try {
            const readyCycles = cycles.filter(c => c.cycleStatus === 'draft_due');
            for (const cycle of readyCycles) {
                const periodStart = cycle.periodStartStr || cycle.currentPeriodStart || (cycle.dueDateStr ? cycle.dueDateStr.split('T')[0] : new Date().toISOString().split('T')[0]);
                const periodEnd = cycle.periodEndStr || periodStart;

                await generateEligibleDraftFromConfig({
                    configId: cycle.config.id,
                    periodStartStr: periodStart,
                    periodEndStr: periodEnd,
                    amountPence: cycle.config.agreedMonthlyPence,
                });
            }
            startTransition(() => router.refresh());
        } finally {
            setIsGeneratingAll(false);
        }
    };

    const filtered = filter === 'all' ? cycles : cycles.filter(c => c.cycleStatus === filter);

    const counts = {
        all:          cycles.length,
        draft_due:    cycles.filter(c => c.cycleStatus === 'draft_due').length,
        draft_review: cycles.filter(c => c.cycleStatus === 'draft_review').length,
        scheduled: cycles.filter(c => c.cycleStatus === 'scheduled').length,
        needs_setup:  cycles.filter(c => c.cycleStatus === 'needs_setup').length,
        invoice_sent: cycles.filter(c => c.cycleStatus === 'invoice_sent').length,
        skipped:      cycles.filter(c => c.cycleStatus === 'skipped').length,
        data_review_required: cycles.filter(c => c.cycleStatus === 'data_review_required').length,
        paused: cycles.filter(c => c.cycleStatus === 'paused').length,
    };

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
                <p>Billing includes confirmed signed-up students, or existing students explicitly confirmed by an Owner or Manager. Returning a registration form alone does not enable billing.</p>
                <p>Prospective families stay in <Link href="/dashboard/registrations" className="text-primary underline">Registrations</Link> and <Link href="/dashboard/students" className="text-primary underline">Students</Link> for follow-up. Older or imported records without confirmation need review on the student profile. Existing invoices, payments and receipts remain available.</p>
            </div>
            <p className="text-sm text-muted-foreground">One card per family billing arrangement. Drafts are unissued invoices; outstanding totals include issued invoices only. Preparing drafts and issuing them are separate actions.</p>
            {/* Family filters and draft preparation */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'draft_due', 'draft_review', 'scheduled', 'needs_setup', 'invoice_sent', 'skipped', 'data_review_required', 'paused'] as const).filter(f => !['data_review_required', 'paused'].includes(f) || counts[f] > 0).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                filter === f
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-primary'
                            }`}
                        >
                            {{ all: 'All families', draft_due: 'Draft preparation due', draft_review: 'Drafts awaiting review', scheduled: 'Scheduled', needs_setup: 'Needs setup', invoice_sent: 'Invoice issued', skipped: 'Skipped', data_review_required: 'Needs review', paused: 'Paused' }[f]}
                            {' '}<span className="opacity-70">({counts[f]})</span>
                        </button>
                    ))}
                </div>

                {counts.draft_due > 0 && (
                    <button 
                        disabled={isGeneratingAll}
                        onClick={() => setShowBulkConfirm(true)}
                        className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-xs font-black hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-[0.97] disabled:opacity-50"
                    >
                        {isGeneratingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Prepare eligible drafts ({counts.draft_due})
                    </button>
                )}
            </div>

            {/* Cards grid */}
            {filtered.length === 0 ? (
                <div className="py-16 text-center">
                    <div className="w-14 h-14 bg-secondary/60 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <CreditCard className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-base font-bold text-muted-foreground">No family billing cycles</p>
                    <p className="text-sm text-muted-foreground mt-1">Set up billing on each family's student profile to see them here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    {filtered.map(cycle => (
                        <FamilyBillingCard
                            key={cycle.config.id}
                            cycle={cycle}
                            onGenerated={handleGenerated}
                        />
                    ))}
                </div>
            )}

            {showBulkConfirm && (
                <BulkInvoiceConfirmModal
                    isOpen={showBulkConfirm}
                    onClose={() => setShowBulkConfirm(false)}
                    onConfirm={async () => {
                        await handleGenerateAll();
                    }}
                    cycles={cycles.filter(c => c.cycleStatus === 'draft_due')}
                />
            )}

            {isPending && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Refreshing…
                </div>
            )}
        </div>
    );
}
