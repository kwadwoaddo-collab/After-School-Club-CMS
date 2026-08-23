'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
    AlertCircle, CheckCircle2, Award, Download, Shield, X, Loader2, Users
} from 'lucide-react';
import Link from 'next/link';
import type { StudentLedgerEntry } from '@/features/attendance/actions';
import { forgiveSessionsAction } from '@/features/attendance/actions';
import { useToast } from '@/components/ui/ToastProvider';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import { getAvatarGradient } from '@/components/ui/utils';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
    ledger: StudentLedgerEntry[];
    centres: { id: string; name: string }[];
    selectedCentreId: string;
    selectedYear: string;
    academicYears: string[];
}

function BalancePill({ balance }: { balance: number }) {
    if (balance > 0) return (
        <Badge variant="success">
            <TrendingUp className="w-3 h-3" />
            +{balance} ahead
        </Badge>
    );
    if (balance < 0) return (
        <Badge variant="error">
            <TrendingDown className="w-3 h-3" />
            {balance} owed
        </Badge>
    );
    return (
        <Badge variant="default">
            <Minus className="w-3 h-3" />
            Even
        </Badge>
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
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                toast({ title: 'Could not forgive sessions', message, variant: 'error' });
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
                    <div>
                        <h3 className="text-section-title text-text">Forgive Sessions</h3>
                        <p className="text-xs text-text-muted mt-0.5">{entry.firstName} {entry.lastName} · Currently {entry.netBalance < 0 ? `${Math.abs(entry.netBalance)} owed` : 'even/ahead'}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-label text-text-muted mb-2">Sessions to forgive</label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setAmount(Math.max(1, amount - 1))}
                                className="w-10 h-10 rounded-sm border border-border bg-page hover:bg-border-subtle text-text font-bold text-lg flex items-center justify-center transition-colors"
                            >−</button>
                            <span className="text-2xl font-bold text-text w-8 text-center">{amount}</span>
                            <button
                                onClick={() => setAmount(amount + 1)}
                                className="w-10 h-10 rounded-sm border border-border bg-page hover:bg-border-subtle text-text font-bold text-lg flex items-center justify-center transition-colors"
                            >+</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-label text-text-muted mb-2">Reason (required) *</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="e.g. Parent agreement on 14/07/26 — illness period waived"
                            className="w-full px-4 py-3 rounded-sm border border-border bg-surface text-text text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors resize-none"
                        />
                    </div>
                    <div className="p-3 rounded-md bg-warning-soft border border-transparent text-amber-700 dark:text-amber-400 text-xs font-medium">
                        This action is permanent and recorded in the audit log with your name.
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={submit} disabled={isPending}>
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <Shield className="w-3.5 h-3.5" />
                        Confirm Forgiveness
                    </Button>
                </div>
            </div>
        </div>
    );
}

function LedgerRow({ entry, onRefresh }: { entry: StudentLedgerEntry; onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [showForgive, setShowForgive] = useState(false);

    const statusColor = entry.netBalance < 0
        ? 'border-l-4 border-l-danger'
        : entry.netBalance > 0
            ? 'border-l-4 border-l-emerald-500'
            : 'border-l-4 border-l-border';

    return (
        <>
            <Card className={`overflow-hidden ${statusColor}`}>
                <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-page/40 transition-colors"
                    onClick={() => setExpanded(!expanded)}
                >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-gradient-to-br ${getAvatarGradient(entry.firstName || 'U')}`}>
                        {(entry.firstName || '')[0] || ''}{(entry.lastName || '')[0] || ''}
                    </div>

                    {/* Name & schedule */}
                    <div className="flex-1 min-w-0">
                        {entry.childId ? (
                            <Link href={`/dashboard/students/${entry.childId}`} className="font-semibold text-text text-sm hover:underline hover:text-accent transition-colors" onClick={(e) => e.stopPropagation()}>
                                {entry.firstName} {entry.lastName}
                            </Link>
                        ) : (
                            <p className="font-semibold text-text text-sm">{entry.firstName} {entry.lastName}</p>
                        )}
                        <p className="text-xs text-text-muted">Year {entry.schoolYear} · {entry.schedule}</p>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-center">
                        <div>
                            <p className="text-xs text-text-muted font-medium">Absences</p>
                            <p className="text-sm font-bold text-text">{entry.scheduledAbsences}</p>
                        </div>
                        <div>
                            <p className="text-xs text-text-muted font-medium">Extras</p>
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">+{entry.extraSessionsAttended}</p>
                        </div>
                        {entry.forgivenSessions > 0 && (
                            <div>
                                <p className="text-xs text-text-muted font-medium">Forgiven</p>
                                <p className="text-sm font-bold text-accent">+{entry.forgivenSessions}</p>
                            </div>
                        )}
                    </div>

                    {/* Balance */}
                    <div className="flex items-center gap-3">
                        <BalancePill balance={entry.netBalance} />
                        {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                    <div className="border-t border-border-subtle bg-page/60 px-5 py-4 space-y-4">
                        {/* Mobile stats row */}
                        <div className="flex sm:hidden items-center gap-6 text-center pb-3 border-b border-border-subtle">
                            <div>
                                <p className="text-xs text-text-muted">Absences</p>
                                <p className="text-sm font-bold text-text">{entry.scheduledAbsences}</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-muted">Extras</p>
                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">+{entry.extraSessionsAttended}</p>
                            </div>
                            {entry.forgivenSessions > 0 && (
                                <div>
                                    <p className="text-xs text-text-muted">Forgiven</p>
                                    <p className="text-sm font-bold text-accent">+{entry.forgivenSessions}</p>
                                </div>
                            )}
                        </div>

                        {/* Missed dates */}
                        {entry.missedDates.length > 0 && (
                            <div>
                                <p className="text-label text-text-muted mb-2">Missed Sessions ({entry.missedDates.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {entry.missedDates.map(d => (
                                        <span key={d} className="px-2.5 py-1 rounded-sm bg-danger-soft text-danger text-xs font-semibold border border-transparent">{d}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Extra dates */}
                        {entry.extraDates.length > 0 && (
                            <div>
                                <p className="text-label text-text-muted mb-2">Extra Sessions ⭐ ({entry.extraDates.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {entry.extraDates.map(d => (
                                        <span key={d} className="px-2.5 py-1 rounded-sm bg-success-soft text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-transparent">{d}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Forgiven entries */}
                        {entry.forgivenEntries.length > 0 && (
                            <div>
                                <p className="text-label text-text-muted mb-2">Admin Forgiveness</p>
                                <div className="space-y-2">
                                    {entry.forgivenEntries.map((f, i) => (
                                        <div key={i} className="px-3 py-2 rounded-sm bg-info-soft border border-transparent text-xs">
                                            <span className="font-bold text-blue-700 dark:text-blue-400">+{f.amount} session{f.amount > 1 ? 's' : ''} forgiven</span>
                                            <span className="text-blue-700/80 dark:text-blue-400/80"> on {f.date}</span>
                                            {f.adminName && <span className="text-blue-700/70 dark:text-blue-400/70"> by {f.adminName}</span>}
                                            {f.note && <p className="text-blue-700/80 dark:text-blue-400/80 mt-0.5 italic">"{f.note}"</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Formula */}
                        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                            <p className="text-xs text-text-muted font-mono">
                                {entry.extraSessionsAttended} extras + {entry.forgivenSessions} forgiven − {entry.scheduledAbsences} absences = <span className="font-bold text-text">{entry.netBalance > 0 ? '+' : ''}{entry.netBalance}</span>
                            </p>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={e => { e.stopPropagation(); setShowForgive(true); }}
                                className="text-accent hover:text-accent-hover"
                            >
                                <Shield className="w-3.5 h-3.5" />
                                Forgive Sessions
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

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
            <HeaderPortal targetId="header-left">
                <h1 className="text-page-title text-text">Session Ledger</h1>
            </HeaderPortal>
            <HeaderPortal targetId="header-right-actions">
                <Button variant="outline" onClick={exportCsv}>
                    <Download className="w-4 h-4" />
                    Export CSV
                </Button>
            </HeaderPortal>

            <p className="text-small-body text-text-secondary -mt-2">Track absences, catch-ups, and session balances — academic year {selectedYear}</p>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <select
                    value={selectedCentreId}
                    onChange={e => handleCentreChange(e.target.value)}
                    className="w-full sm:w-auto h-9 px-3 rounded-sm border border-border bg-surface text-text text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                >
                    {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                    value={selectedYear}
                    onChange={e => handleYearChange(e.target.value)}
                    className="w-full sm:w-auto h-9 px-3 rounded-sm border border-border bg-surface text-text text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                >
                    {academicYears.map(y => <option key={y} value={y}>{y} Academic Year</option>)}
                </select>
                <div className="relative flex-1 w-full">
                    <input
                        type="text"
                        placeholder="Search students..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-9 pl-4 pr-4 rounded-sm border border-border bg-surface text-text text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                    />
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Students', value: ledger.length, icon: <Award className="w-4 h-4" />, iconBg: 'bg-accent-soft text-accent', valueColor: 'text-text' },
                    { label: 'In Arrears', value: arrearsCount, icon: <TrendingDown className="w-4 h-4" />, iconBg: 'bg-danger-soft text-danger', valueColor: 'text-danger' },
                    { label: 'All Even', value: evenCount, icon: <Minus className="w-4 h-4" />, iconBg: 'bg-page text-text-muted', valueColor: 'text-text' },
                    { label: 'Ahead', value: aheadCount, icon: <TrendingUp className="w-4 h-4" />, iconBg: 'bg-success-soft text-emerald-700 dark:text-emerald-400', valueColor: 'text-emerald-700 dark:text-emerald-400' },
                ].map(s => (
                    <Card key={s.label}>
                        <div className="p-5 flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-md ${s.iconBg}`}>
                                    {s.icon}
                                </div>
                                <span className="text-label text-text-muted">{s.label}</span>
                            </div>
                            <p className={`text-3xl font-bold tabular-nums ${s.valueColor}`}>{s.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Date-range preset chips — C-5 */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-label text-text-muted mr-1">Period:</span>
                {([
                    { id: 'this_week',  label: 'This Week'  },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'this_term',  label: 'This Term'  },
                ] as const).map(chip => (
                    <button
                        key={chip.id}
                        onClick={() => setDatePreset(chip.id)}
                        aria-pressed={datePreset === chip.id}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                            datePreset === chip.id
                                ? 'bg-accent text-white border-accent'
                                : 'bg-surface border-border text-text-muted hover:border-accent/40'
                        }`}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-page rounded-md w-fit">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-sm text-xs font-semibold transition-colors ${
                            tab === t.id
                                ? 'bg-surface text-text shadow-sm'
                                : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Ledger rows */}
            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={<Users className="w-8 h-8" />}
                        title="No students found"
                        description="Try changing the filter or selecting a different centre."
                    />
                ) : (
                    filtered.map(entry => <LedgerRow key={entry.childId} entry={entry} onRefresh={() => router.refresh()} />)
                )}
            </div>

            {arrearsCount > 0 && tab === 'all' && (
                <div className="flex items-start gap-3 p-4 bg-warning-soft border border-transparent rounded-md">
                    <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        <strong>{arrearsCount} student{arrearsCount > 1 ? 's are' : ' is'}</strong> in arrears for the {selectedYear} academic year.
                        Switch to the <strong>In Arrears</strong> tab to see only these students and take action.
                    </p>
                </div>
            )}
        </div>
    );
}
