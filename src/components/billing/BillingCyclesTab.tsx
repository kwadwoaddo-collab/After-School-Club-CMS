'use client';

import { useState, useTransition } from 'react';
import { CreditCard, AlertCircle, ArrowRight, RefreshCw, Settings2, Users } from 'lucide-react';
import GenerateInvoiceModal from './GenerateInvoiceModal';
import { useRouter } from 'next/navigation';
import type { BillingCycleRow } from '@/features/billing/queries';

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: BillingCycleRow['cycleStatus'] }) {
    const map = {
        ready:        { label: 'Ready',        cls: 'bg-primary/15 text-primary border-primary/30' },
        needs_setup:  { label: 'Needs Setup',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
        invoice_sent: { label: 'Invoice Sent', cls: 'bg-secondary/60 text-muted-foreground border-border' },
        paused:       { label: 'Paused',       cls: 'bg-secondary/60 text-muted-foreground border-border' },
    };
    const { label, cls } = map[status];
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${cls}`}>
            {label}
        </span>
    );
}

// ─── Family billing card ──────────────────────────────────────────────────────

function FamilyBillingCard({ cycle, onGenerated }: { cycle: BillingCycleRow; onGenerated: () => void }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);

    const canGenerate = cycle.cycleStatus === 'ready' && cycle.config.agreedMonthlyPence > 0;

    const invoiceDateStr = cycle.nextInvoiceDateStr
        ? cycle.nextInvoiceDateStr.split('T')[0]
        : new Date().toISOString().split('T')[0];
    const dueDateStr = cycle.dueDateStr
        ? cycle.dueDateStr.split('T')[0]
        : new Date().toISOString().split('T')[0];

    const lastRunDisplay = cycle.lastRunAt
        ? new Date(cycle.lastRunAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;

    return (
        <>
            <div className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                cycle.cycleStatus === 'paused'      ? 'opacity-60' :
                cycle.cycleStatus === 'needs_setup' ? 'border-amber-200' : 'border-border'
            }`}>
                {/* Card header */}
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground truncate">{cycle.familyName}</p>
                        {cycle.centreName && (
                            <p className="text-xs text-muted-foreground font-semibold">{cycle.centreName}</p>
                        )}
                    </div>
                    <StatusPill status={cycle.cycleStatus} />
                </div>

                <div className="mx-4 border-t border-border" />

                {/* Children list */}
                {cycle.coveredChildren.length > 0 && (
                    <div className="px-4 pt-3 flex flex-wrap gap-1.5">
                        {cycle.coveredChildren.map(c => (
                            <span
                                key={c.childId}
                                className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold"
                            >
                                {c.childName}
                            </span>
                        ))}
                    </div>
                )}

                {/* Card body */}
                <div className="px-4 py-3 space-y-2">
                    {cycle.periodLabel && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Next period</span>
                            <span className="font-bold text-foreground text-xs">{cycle.periodLabel}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Monthly fee</span>
                        <span className="font-black text-foreground text-base">{cycle.amountDisplay}</span>
                    </div>
                    {lastRunDisplay && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Last invoice</span>
                            <span className="text-xs text-muted-foreground font-semibold">{lastRunDisplay}</span>
                        </div>
                    )}
                    {cycle.cycleStatus === 'needs_setup' && (
                        <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Set a monthly fee on the student's profile
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex gap-2">
                    <button
                        onClick={() => cycle.coveredChildren[0]
                            ? router.push(`/dashboard/students/${cycle.coveredChildren[0].childId}`)
                            : null
                        }
                        className="flex-1 h-10 rounded-xl bg-secondary/60 text-foreground text-xs font-bold hover:bg-secondary transition-all flex items-center justify-center gap-1.5"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        Profile
                    </button>
                    <button
                        disabled={!canGenerate}
                        onClick={() => setShowModal(true)}
                        className={`flex-1 h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-[0.97] ${
                            canGenerate
                                ? 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20'
                                : 'bg-secondary/60 text-muted-foreground cursor-not-allowed'
                        }`}
                    >
                        Invoice
                        {canGenerate && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

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
    const [filter, setFilter] = useState<'all' | 'ready' | 'needs_setup' | 'invoice_sent'>('all');

    const handleGenerated = () => startTransition(() => router.refresh());

    const filtered = filter === 'all' ? cycles : cycles.filter(c => c.cycleStatus === filter);

    const counts = {
        all:          cycles.length,
        ready:        cycles.filter(c => c.cycleStatus === 'ready').length,
        needs_setup:  cycles.filter(c => c.cycleStatus === 'needs_setup').length,
        invoice_sent: cycles.filter(c => c.cycleStatus === 'invoice_sent').length,
    };

    return (
        <div className="space-y-5">
            {/* Filter pills + Generate All */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'ready', 'needs_setup', 'invoice_sent'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                filter === f
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-primary'
                            }`}
                        >
                            {f === 'all' ? 'All' : f === 'needs_setup' ? 'Needs Setup' : f === 'invoice_sent' ? 'Sent' : 'Ready'}
                            {' '}<span className="opacity-70">({counts[f]})</span>
                        </button>
                    ))}
                </div>

                {counts.ready > 1 && (
                    <button className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-xs font-black hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-[0.97]">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Generate All ({counts.ready} ready)
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(cycle => (
                        <FamilyBillingCard
                            key={cycle.config.id}
                            cycle={cycle}
                            onGenerated={handleGenerated}
                        />
                    ))}
                </div>
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
