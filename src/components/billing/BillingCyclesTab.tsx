'use client';

import { useState, useTransition } from 'react';
import { CreditCard, AlertCircle, ArrowRight, RefreshCw, Settings2 } from 'lucide-react';
import { penceToPounds } from '@/lib/billing';
import GenerateInvoiceModal from './GenerateInvoiceModal';
import { useRouter } from 'next/navigation';
import type { BillingCycleRow } from '@/features/billing/queries';

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: BillingCycleRow['cycleStatus'] }) {
    const map = {
        ready:        { label: 'Ready',        cls: 'bg-blue-100 text-blue-700 border-blue-200' },
        needs_setup:  { label: 'Needs Setup',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
        invoice_sent: { label: 'Invoice Sent', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
        paused:       { label: 'Paused',       cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    };
    const { label, cls } = map[status];
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${cls}`}>
            {label}
        </span>
    );
}

// ─── Individual student billing card ─────────────────────────────────────────

function StudentBillingCard({ cycle, onGenerated }: { cycle: BillingCycleRow; onGenerated: () => void }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);

    const isUc = cycle.config.billingType === 'uc';
    const canGenerate = cycle.cycleStatus === 'ready' && cycle.amountPence > 0;

    // Dates are already ISO strings from the server
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
            <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                cycle.cycleStatus === 'paused' ? 'opacity-60' : ''
            } ${cycle.cycleStatus === 'needs_setup' ? 'border-amber-200' : 'border-gray-200'}`}>

                {/* Card header */}
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-black text-gray-900 truncate">
                                {cycle.childName || cycle.parentName}
                            </span>
                            {!cycle.config.childId && (
                                <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-black uppercase tracking-wider">Family</span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 font-semibold">
                            {isUc ? 'UC · Family plan' : `Non-UC · ${cycle.config.sessionsPerWeek ?? '—'} sessions/week`}
                        </p>
                    </div>
                    <StatusPill status={cycle.cycleStatus} />
                </div>

                <div className="mx-4 border-t border-gray-100" />

                {/* Card body */}
                <div className="px-4 py-3 space-y-2">
                    {cycle.periodLabel && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Next period</span>
                            <span className="font-bold text-gray-900 truncate max-w-[60%] text-right text-xs">{cycle.periodLabel}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Amount</span>
                        <span className="font-black text-gray-900 text-base">{cycle.amountDisplay}</span>
                    </div>
                    {lastRunDisplay && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Last invoice</span>
                            <span className="text-xs text-gray-500 font-semibold">{lastRunDisplay}</span>
                        </div>
                    )}
                    {cycle.cycleStatus === 'needs_setup' && (
                        <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Complete billing config to generate invoices
                        </p>
                    )}
                </div>

                {/* Action buttons */}
                <div className="px-4 pb-4 flex gap-2">
                    {cycle.config.childId && (
                        <button
                            onClick={() => router.push(`/dashboard/students/${cycle.config.childId}`)}
                            className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-1.5"
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                            Profile
                        </button>
                    )}
                    <button
                        disabled={!canGenerate}
                        onClick={() => setShowModal(true)}
                        className={`flex-1 h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-[0.97] ${
                            canGenerate
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-100'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Generate Invoice
                        {canGenerate && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {showModal && (
                <GenerateInvoiceModal
                    configId={cycle.config.id}
                    childName={cycle.childName || cycle.parentName}
                    parentName={cycle.parentName}
                    parentEmail={cycle.parentEmail}
                    amountPence={cycle.amountPence}
                    periodLabel={cycle.periodLabel}
                    invoiceDateStr={invoiceDateStr}
                    dueDateStr={dueDateStr}
                    rateSource={cycle.rateSource}
                    onClose={() => setShowModal(false)}
                    onSuccess={onGenerated}
                />
            )}
        </>
    );
}

// ─── Billing Cycles Tab ───────────────────────────────────────────────────────

interface Props {
    cycles: BillingCycleRow[];
    centreId: string;
}

export default function BillingCyclesTab({ cycles, centreId }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState<'all' | 'ready' | 'needs_setup' | 'invoice_sent'>('all');

    const handleGenerated = () => {
        startTransition(() => { router.refresh(); });
    };

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
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                            }`}
                        >
                            {f === 'all' ? 'All' : f === 'needs_setup' ? 'Needs Setup' : f === 'invoice_sent' ? 'Sent' : 'Ready'}
                            {' '}<span className="opacity-70">({counts[f]})</span>
                        </button>
                    ))}
                </div>

                {counts.ready > 1 && (
                    <button className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-all shadow-sm shadow-blue-100 active:scale-[0.97]">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Generate All ({counts.ready} ready)
                    </button>
                )}
            </div>

            {/* Cards grid */}
            {filtered.length === 0 ? (
                <div className="py-16 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <CreditCard className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-base font-bold text-gray-600">No billing cycles</p>
                    <p className="text-sm text-gray-400 mt-1">Set up billing on each student's profile to see them here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(cycle => (
                        <StudentBillingCard
                            key={cycle.config.id}
                            cycle={cycle}
                            onGenerated={handleGenerated}
                        />
                    ))}
                </div>
            )}

            {isPending && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Refreshing…
                </div>
            )}
        </div>
    );
}
