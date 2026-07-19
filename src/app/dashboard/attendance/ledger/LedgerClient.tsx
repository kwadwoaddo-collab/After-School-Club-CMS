'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
    AlertCircle, CheckCircle2, Award, Download, Shield, X, Loader2, Users
} from 'lucide-react';
import type { StudentLedgerEntry } from '@/features/attendance/actions';
import { forgiveSessionsAction } from '@/features/attendance/actions';
import { useToast } from '@/components/ui/ToastProvider';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface Props {
    ledger: StudentLedgerEntry[];
    centres: { id: string; name: string }[];
    selectedCentreId: string;
    selectedYear: string;
    academicYears: string[];
}

function BalancePill({ balance }: { balance: number }) {
    if (balance > 0) return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20">
            <TrendingUp className="w-3 h-3" />
            +{balance} ahead
        </span>
    );
    if (balance < 0) return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-error-container/10 text-error border border-error/20">
            <TrendingDown className="w-3 h-3" />
            {balance} owed
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-secondary/60 text-muted-foreground border border-border">
            <Minus className="w-3 h-3" />
            Even
        </span>
    );
}

function ForgivModal({
    entry,
    onClose,
}: {
    entry: StudentLedgerEntry;
    onClose: () => void;
}) {
    const { toast } = useToast();
    const [amount, setAmount] = useState(1);
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();

    const submit = () => {
        if (!note.trim()) {
            toast({ title: 'Note required', message: 'Please add a reason for this forgiveness.', variant: 'warning' });
            return;
        }
        startTransition(async () => {
            try {
                await forgiveSessionsAction({ childId: entry.childId, sessionsAmount: amount, note });
                toast({ title: 'Sessions forgiven', message: `${amount} session(s) written off for ${entry.firstName}.`, variant: 'success' });
                onClose();
            } catch (e: any) {
                toast({ title: 'Could not forgive sessions', message: e.message, variant: 'error' });
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <div>
                        <h3 className="text-base font-bold text-foreground">Forgive Sessions</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.firstName} {entry.lastName} · Currently {entry.netBalance < 0 ? `${Math.abs(entry.netBalance)} owed` : 'even/ahead'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 text-muted-foreground hover:text-muted-foreground transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Sessions to forgive</label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setAmount(Math.max(1, amount - 1))}
                                className="w-10 h-10 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/60 text-foreground font-bold text-lg flex items-center justify-center transition-all"
                            >−</button>
                            <span className="text-2xl font-black text-foreground w-8 text-center">{amount}</span>
                            <button
                                onClick={() => setAmount(amount + 1)}
                                className="w-10 h-10 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/60 text-foreground font-bold text-lg flex items-center justify-center transition-all"
                            >+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Reason (required) *</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="e.g. Parent agreement on 14/07/26 — illness period waived"
                            className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                        />
                    </div>
                    <div className="p-3 rounded-2xl bg-warning/10 border border-warning/20 text-warning text-xs font-medium">
                        ⚠ This action is permanent and recorded in the audit log with your name.
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-secondary/40 text-sm font-semibold transition-all">Cancel</button>
                    <button
                        onClick={submit}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <Shield className="w-3.5 h-3.5" />
                        Confirm Forgiveness
                    </button>
                </div>
            </div>
        </div>
    );
}

function LedgerRow({ entry, onRefresh }: { entry: StudentLedgerEntry; onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [showForgive, setShowForgive] = useState(false);

    const statusColor = entry.netBalance < 0
        ? 'border-l-4 border-l-error'
        : entry.netBalance > 0
            ? 'border-l-4 border-l-tertiary'
            : 'border-l-4 border-l-border';

    return (
        <>
            <div className={`bg-card border border-border rounded-2xl overflow-hidden ${statusColor} transition-all hover:shadow-sm`}>
                <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                    onClick={() => setExpanded(!expanded)}
                >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        entry.netBalance < 0 ? 'bg-error-container/10 text-error' :
                        entry.netBalance > 0 ? 'bg-tertiary-container/10 text-tertiary' : 'bg-secondary/60 text-muted-foreground'
                    }`}>
                        {(entry.firstName || '')[0] || ''}{(entry.lastName || '')[0] || ''}
                    </div>

                    {/* Name & schedule */}
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">{entry.firstName} {entry.lastName}</p>
                        <p className="text-xs text-muted-foreground">Year {entry.schoolYear} · {entry.schedule}</p>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-center">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Absences</p>
                            <p className="text-sm font-bold text-foreground">{entry.scheduledAbsences}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Extras</p>
                            <p className="text-sm font-bold text-tertiary">+{entry.extraSessionsAttended}</p>
                        </div>
                        {entry.forgivenSessions > 0 && (
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Forgiven</p>
                                <p className="text-sm font-bold text-primary">+{entry.forgivenSessions}</p>
                            </div>
                        )}
                    </div>

                    {/* Balance */}
                    <div className="flex items-center gap-3">
                        <BalancePill balance={entry.netBalance} />
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                    <div className="border-t border-border bg-secondary/40 px-5 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Mobile stats row */}
                        <div className="flex sm:hidden items-center gap-6 text-center pb-3 border-b border-border">
                            <div>
                                <p className="text-xs text-muted-foreground">Absences</p>
                                <p className="text-sm font-bold text-foreground">{entry.scheduledAbsences}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Extras</p>
                                <p className="text-sm font-bold text-tertiary">+{entry.extraSessionsAttended}</p>
                            </div>
                            {entry.forgivenSessions > 0 && (
                                <div>
                                    <p className="text-xs text-muted-foreground">Forgiven</p>
                                    <p className="text-sm font-bold text-primary">+{entry.forgivenSessions}</p>
                                </div>
                            )}
                        </div>

                        {/* Missed dates */}
                        {entry.missedDates.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Missed Sessions ({entry.missedDates.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {entry.missedDates.map(d => (
                                        <span key={d} className="px-2.5 py-1 rounded-lg bg-error-container/10 text-error text-xs font-semibold border border-error/15">{d}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Extra dates */}
                        {entry.extraDates.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Extra Sessions ⭐ ({entry.extraDates.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {entry.extraDates.map(d => (
                                        <span key={d} className="px-2.5 py-1 rounded-lg bg-tertiary-container/10 text-tertiary text-xs font-semibold border border-tertiary/15">{d}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Forgiven entries */}
                        {entry.forgivenEntries.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Admin Forgiveness</p>
                                <div className="space-y-2">
                                    {entry.forgivenEntries.map((f, i) => (
                                        <div key={i} className="px-3 py-2 rounded-xl bg-info/10 border border-info/20 text-xs">
                                            <span className="font-bold text-info">+{f.amount} session{f.amount > 1 ? 's' : ''} forgiven</span>
                                            <span className="text-info/80"> on {f.date}</span>
                                            {f.adminName && <span className="text-info/70"> by {f.adminName}</span>}
                                            {f.note && <p className="text-info/80 mt-0.5 italic">"{f.note}"</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Formula */}
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground font-mono">
                                {entry.extraSessionsAttended} extras + {entry.forgivenSessions} forgiven − {entry.scheduledAbsences} absences = <span className="font-bold text-foreground">{entry.netBalance > 0 ? '+' : ''}{entry.netBalance}</span>
                            </p>
                            <button
                                onClick={e => { e.stopPropagation(); setShowForgive(true); }}
                                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primary/8 transition-all"
                            >
                                <Shield className="w-3.5 h-3.5" />
                                Forgive Sessions
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showForgive && (
                <ForgivModal entry={entry} onClose={() => { setShowForgive(false); onRefresh(); }} />
            )}
        </>
    );
}

export default function LedgerClient({ ledger, centres, selectedCentreId, selectedYear, academicYears }: Props) {
    const router = useRouter();
    const { setSelectedCentreId } = useCentreFilter();
    const [tab, setTab] = useState<'all' | 'arrears' | 'ahead' | 'even'>('all');
    const [search, setSearch] = useState('');

    type DatePreset = 'this_week' | 'this_month' | 'this_term';
    const [datePreset, setDatePreset] = useState<DatePreset>('this_month');

    function getPresetRange(preset: 'this_week' | 'this_month' | 'this_term'): { from: Date; to: Date } {
        const now = new Date();
        if (preset === 'this_week') {
            const day = now.getDay();
            const mon = new Date(now);
            mon.setDate(now.getDate() - ((day + 6) % 7));
            mon.setHours(0, 0, 0, 0);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            sun.setHours(23, 59, 59, 999);
            return { from: mon, to: sun };
        }
        if (preset === 'this_month') {
            return {
                from: new Date(now.getFullYear(), now.getMonth(), 1),
                to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
            };
        }
        // UK terms: Autumn Sep-Dec, Spring Jan-Mar, Summer Apr-Jul
        const m = now.getMonth();
        const y = now.getFullYear();
        if (m >= 8) return { from: new Date(y, 8, 1), to: new Date(y, 11, 31, 23, 59, 59) };
        if (m <= 2) return { from: new Date(y, 0, 1), to: new Date(y, 2,  31, 23, 59, 59) };
        return           { from: new Date(y, 3, 1), to: new Date(y, 6,  25, 23, 59, 59) };
    }

    const { from: presetFrom, to: presetTo } = getPresetRange(datePreset);

    const filtered = ledger.filter(e => {
        const matchTab =
            tab === 'all' ||
            (tab === 'arrears' && e.netBalance < 0) ||
            (tab === 'ahead'   && e.netBalance > 0) ||
            (tab === 'even'    && e.netBalance === 0);

        const matchSearch = !search ||
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase());

        // Date filter: include if ANY session date falls in the preset range.
        // Entries with no date data always pass (they may have a balance from pre-loaded data).
        const hasDateActivity = e.missedDates.length > 0 || e.extraDates.length > 0;
        const matchDate = !hasDateActivity || [...e.missedDates, ...e.extraDates].some(d => {
            // Handle ISO (YYYY-MM-DD) and most locale date strings
            const dt = /^\d{2}\/\d{2}\/\d{4}$/.test(d) ? new Date(d.split('/').reverse().join('-')) : new Date(d);
            return dt >= presetFrom && dt <= presetTo;
        });

        return matchTab && matchSearch && matchDate;
    });

    const arrearsCount = ledger.filter(e => e.netBalance < 0).length;
    const aheadCount = ledger.filter(e => e.netBalance > 0).length;
    const evenCount = ledger.filter(e => e.netBalance === 0).length;

    const handleCentreChange = (centreId: string) => {
        // Use the global context setter — it writes the cookie AND calls router.refresh()
        // so the server re-render picks up the new value correctly
        setSelectedCentreId(centreId);
        router.push(`/dashboard/attendance/ledger?year=${selectedYear}`);
    };
    const handleYearChange = (year: string) => {
        router.push(`/dashboard/attendance/ledger?year=${year}`);
    };


    const exportCsv = () => {
        const headers = ['Name', 'Year', 'Schedule', 'Absences', 'Extras', 'Forgiven', 'Balance', 'Status'];
        const rows = filtered.map(e => [
            `${e.firstName} ${e.lastName}`,
            e.schoolYear,
            e.schedule,
            e.scheduledAbsences,
            e.extraSessionsAttended,
            e.forgivenSessions,
            e.netBalance,
            e.netBalance < 0 ? 'In Arrears' : e.netBalance > 0 ? 'Ahead' : 'Even',
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `session-ledger-${selectedYear}.csv`;
        a.click();
    };

    const TABS = [
        { id: 'all', label: `All (${ledger.length})` },
        { id: 'arrears', label: `In Arrears (${arrearsCount})` },
        { id: 'ahead', label: `Ahead (${aheadCount})` },
        { id: 'even', label: `Even (${evenCount})` },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Session Ledger</h1>
                    <p className="text-sm text-muted-foreground mt-1">Track absences, catch-ups, and session balances — academic year {selectedYear}</p>
                </div>
                <button
                    onClick={exportCsv}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-secondary/40 transition-all shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <select
                    value={selectedCentreId}
                    onChange={e => handleCentreChange(e.target.value)}
                    className="w-full sm:w-auto h-10 px-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                >
                    {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                    value={selectedYear}
                    onChange={e => handleYearChange(e.target.value)}
                    className="w-full sm:w-auto h-10 px-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                >
                    {academicYears.map(y => <option key={y} value={y}>{y} Academic Year</option>)}
                </select>
                <div className="relative flex-1 w-full">
                    <input
                        type="text"
                        placeholder="Search students..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-10 pl-4 pr-4 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    />
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Students', value: ledger.length, icon: <Award className="w-4 h-4" />, color: 'text-primary bg-primary/10 border-primary/20' },
                    { label: 'In Arrears', value: arrearsCount, icon: <TrendingDown className="w-4 h-4" />, color: 'text-error bg-error-container/10 border-error/20' },
                    { label: 'All Even', value: evenCount, icon: <Minus className="w-4 h-4" />, color: 'text-muted-foreground bg-secondary/40 border-border' },
                    { label: 'Ahead', value: aheadCount, icon: <TrendingUp className="w-4 h-4" />, color: 'text-tertiary bg-tertiary-container/10 border-tertiary/20' },
                ].map(s => (
                    <div key={s.label} className={`p-4 rounded-2xl border ${s.color}`}>
                        <div className="flex items-center gap-2 mb-1">
                            {s.icon}
                            <span className="text-xs font-bold uppercase tracking-wide">{s.label}</span>
                        </div>
                        <p className="text-2xl font-black">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Date-range preset chips — C-5 */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">Period:</span>
                {([
                    { id: 'this_week',  label: 'This Week'  },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'this_term',  label: 'This Term'  },
                ] as const).map(chip => (
                    <button
                        key={chip.id}
                        onClick={() => setDatePreset(chip.id)}
                        aria-pressed={datePreset === chip.id}
                        className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                            datePreset === chip.id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                        }`}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            tab === t.id
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Ledger rows */}
            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                        <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="font-semibold text-muted-foreground">No students found</p>
                        <p className="text-sm mt-1">Try changing the filter or selecting a different centre.</p>
                    </div>
                ) : (
                    filtered.map(entry => <LedgerRow key={entry.childId} entry={entry} onRefresh={() => router.refresh()} />)
                )}
            </div>

            {arrearsCount > 0 && tab === 'all' && (
                <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-2xl">
                    <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-warning">
                        <strong>{arrearsCount} student{arrearsCount > 1 ? 's are' : ' is'}</strong> in arrears for the {selectedYear} academic year.
                        Switch to the <strong>In Arrears</strong> tab to see only these students and take action.
                    </p>
                </div>
            )}
        </div>
    );
}
