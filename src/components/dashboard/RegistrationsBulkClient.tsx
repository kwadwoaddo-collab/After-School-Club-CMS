'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Download, Loader2, X, Trash2, AlertTriangle, Mail } from 'lucide-react';
import { assignRegistrationCentre, deleteRegistrations } from '@/app/dashboard/registrations/actions';

type Status = 'awaiting_confirmation' | 'signed_up' | 'not_interested';

interface RegistrationRow {
    id: string;
    status: string;
    createdAt: Date;
    startDate: Date | null;
    centreId: string | null;
    fundingTypes: string[] | null;
    emergencyContactName: string | null;
    registrationChildren: {
        childId: string | null;
        submittedFirstName: string;
        submittedLastName: string;
        submittedSchoolYear: string | null;
        submittedSessions: string[] | null;
    }[];
    registrationParents: {
        isPrimary: boolean | null;
        submittedFirstName: string;
        submittedLastName: string;
        submittedEmail: string | null;
        submittedPhone: string | null;
    }[];
}

interface Props {
    rows: RegistrationRow[];
    statusBadge: Record<string, string>;
    statusLabel: Record<string, string>;
    centres: { id: string; name: string }[];
}

const FUNDING_LABELS: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    universal_credit: 'Universal Credit',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

export default function RegistrationsBulkClient({ rows, statusBadge, statusLabel, centres }: Props) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkMessage, setBulkMessage] = useState('');
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const allIds = rows.map(r => r.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
    const someSelected = selected.size > 0;

    const toggleAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(allIds));
        }
    };

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const bulkUpdateStatus = async (status: Status) => {
        if (selected.size === 0) return;
        setBulkLoading(true);
        setBulkMessage('');
        setConfirmingDelete(false);
        try {
            const ids = Array.from(selected);
            await Promise.all(
                ids.map(id =>
                    fetch(`/api/register/${id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status }),
                    })
                )
            );
            setBulkMessage(`✓ Updated ${ids.length} registration${ids.length !== 1 ? 's' : ''}`);
            setSelected(new Set());
            router.refresh();
        } catch {
            setBulkMessage('Something went wrong. Please try again.');
        } finally {
            setBulkLoading(false);
        }
    };

    const bulkDelete = async () => {
        if (selected.size === 0) return;
        setBulkLoading(true);
        setBulkMessage('');
        setConfirmingDelete(false);
        try {
            const ids = Array.from(selected);
            const result = await deleteRegistrations(ids);
            setBulkMessage(`✓ Deleted ${result.deleted} registration${result.deleted !== 1 ? 's' : ''}`);
            setSelected(new Set());
            router.refresh();
        } catch (err: any) {
            setBulkMessage(err.message || 'Failed to delete. Please try again.');
        } finally {
            setBulkLoading(false);
        }
    };

    const exportCSV = () => {
        const selectedRows = rows.filter(r => selected.has(r.id));
        const header = [
            'ID', 'Status', 'Submitted', 'Start Date',
            'Primary Parent', 'Email', 'Phone',
            'Children', 'Centre', 'Funding',
        ].join(',');

        const csvRows = selectedRows.map(r => {
            const primary = r.registrationParents.find(p => p.isPrimary) ?? r.registrationParents[0];
            const children = r.registrationChildren.map(c => `${c.submittedFirstName} ${c.submittedLastName}`).join('; ');
            const centre = centres.find(c => c.id === r.centreId)?.name ?? '';
            const funding = (r.fundingTypes ?? []).map(t => FUNDING_LABELS[t] ?? t).join('; ');

            const escape = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;

            return [
                escape(r.id),
                escape(statusLabel[r.status] ?? r.status),
                escape(new Date(r.createdAt).toLocaleDateString('en-GB')),
                escape(r.startDate ? new Date(r.startDate).toLocaleDateString('en-GB') : ''),
                escape(primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : ''),
                escape(primary?.submittedEmail ?? ''),
                escape(primary?.submittedPhone ?? ''),
                escape(children),
                escape(centre),
                escape(funding),
            ].join(',');
        });

        const csv = [header, ...csvRows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registrations-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCentreChange = (id: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value === 'null' ? null : e.target.value;
        startTransition(async () => {
            try { await assignRegistrationCentre(id, value); } catch { /* ignore */ }
        });
    };

    return (
        <div>

            {/* Select-all header row */}
            <div className="flex items-center gap-3 mb-3 px-2">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded accent-primary cursor-pointer"
                    />
                    <span className="text-[#8c909f] text-xs font-semibold group-hover:text-white transition-colors">
                        {allSelected ? 'Deselect all' : `Select all (${rows.length})`}
                    </span>
                </label>
                {someSelected && (
                    <span className="text-primary text-xs font-bold ml-auto">
                        {selected.size} selected
                    </span>
                )}
            </div>

            {/* Bulk action bar */}
            {someSelected && (
                <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-[#1a1d23]/95 backdrop-blur-md border border-outline-variant/10 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] animate-in slide-in-from-top-2 duration-200">
                    <span className="text-[#adc6ff] text-sm font-bold">{selected.size} selected</span>
                    <div className="h-4 w-px bg-[#424754]/40 mx-1" />

                    <button
                        onClick={() => bulkUpdateStatus('signed_up')}
                        disabled={bulkLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Confirm all
                    </button>

                    <button
                        disabled={true}
                        title="Email sending coming soon"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/5 border border-blue-500/10 text-blue-400/40 rounded-xl text-sm font-semibold cursor-not-allowed opacity-50"
                    >
                        <Mail className="w-3.5 h-3.5" />
                        Send Email
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 px-1.5 py-0.5 rounded-full">Soon</span>
                    </button>

                    <button
                        onClick={() => bulkUpdateStatus('not_interested')}
                        disabled={bulkLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Mark not interested
                    </button>

                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-outline-variant/10 text-white hover:bg-white/10 rounded-xl text-sm font-semibold transition-all"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>

                    {/* Delete — two-step confirm */}
                    <div className="flex items-center gap-2">
                        {confirmingDelete ? (
                            <>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Delete {selected.size}?
                                </span>
                                <button
                                    onClick={bulkDelete}
                                    disabled={bulkLoading}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, delete'}
                                </button>
                                <button
                                    onClick={() => setConfirmingDelete(false)}
                                    disabled={bulkLoading}
                                    className="px-3 py-2 text-[#8c909f] hover:text-white text-sm font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setConfirmingDelete(true)}
                                disabled={bulkLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => { setSelected(new Set()); setConfirmingDelete(false); }}
                        className="ml-auto p-1.5 text-[#8c909f] hover:text-white transition-colors"
                        title="Clear selection"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {bulkMessage && (
                        <p className={`text-xs font-semibold w-full mt-1 ${bulkMessage.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                            {bulkMessage}
                        </p>
                    )}
                </div>
            )}

            {/* Registration cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rows.map(r => {
                    const primary = r.registrationParents.find(p => p.isPrimary) ?? r.registrationParents[0];
                    const childNames = r.registrationChildren.map(k => `${k.submittedFirstName} ${k.submittedLastName}`).join(', ');
                    const isChecked = selected.has(r.id);

                    return (
                        // ⚠️ Use a div, not Link — the card contains a <select> which cannot
                        // be a descendant of <a> (HTML spec violation / a11y violation)
                        <div
                            key={r.id}
                            className={`relative glassmorphic-card rounded-[24px] flex flex-col justify-between min-h-[220px] group transition-all duration-200 ${
                                isChecked
                                    ? 'border-primary/40 bg-white/[0.03] shadow-[0_0_0_1.5px_rgba(142,171,255,0.4)]'
                                    : 'border-outline-variant/15 hover:border-primary/20 hover:shadow-[0_8px_32px_rgba(142,171,255,0.08)]'
                            }`}
                        >
                            {/* Header row: checkbox (interactive) is a SIBLING of Link — never inside <a> */}
                            <div className="flex items-start gap-3 px-6 pt-6 flex-1">
                                {/* Checkbox — outside Link to comply with HTML spec (no interactive content inside <a>) */}
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleOne(r.id)}
                                    aria-label={`Select registration for ${primary?.submittedFirstName ?? 'unknown'}`}
                                    className="w-4 h-4 rounded accent-primary cursor-pointer flex-shrink-0 mt-1"
                                />

                                {/* Link wraps only text/icon content — no interactive children */}
                                <Link
                                    href={`/dashboard/registrations/${r.id}`}
                                    prefetch={true}
                                    className="flex-1 block min-w-0 pb-4"
                                    aria-label={`View registration for ${primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Unknown Parent'}`}
                                >
                                    {/* Name and Date */}
                                    <div className="flex items-start justify-between gap-2 mb-4">
                                        <p className="text-white font-bold text-base truncate group-hover:text-primary transition-colors">
                                            {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Unknown Parent'}
                                        </p>
                                        <p className="text-[#8c909f] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap pt-1 flex-shrink-0">
                                            {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="mb-4 animate-in fade-in duration-300">
                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadge[r.status] || ''}`}>
                                            {statusLabel[r.status] ?? r.status}
                                        </span>
                                    </div>

                                    {/* Children & Contact Info */}
                                    <div className="space-y-1">
                                        <p className="text-[#8c909f] text-[10px] font-bold uppercase tracking-wider">Children</p>
                                        <p className="text-[#c2c6d6] text-sm font-semibold leading-relaxed line-clamp-2">
                                            {childNames || 'None'}
                                        </p>
                                        {primary?.submittedEmail && (
                                            <p className="text-[#8c909f] text-xs font-semibold truncate mt-2">{primary.submittedEmail}</p>
                                        )}
                                    </div>
                                </Link>
                            </div>

                            {/* Actions Footer — select and footer are outside the Link entirely */}
                            <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-3 border-t border-outline-variant/10">
                                <span className="text-xs font-bold text-primary group-hover:text-blue-400 transition-colors pointer-events-none">
                                    View Details →
                                </span>

                                <select
                                    value={r.centreId || 'null'}
                                    onChange={e => handleCentreChange(r.id, e)}
                                    disabled={isPending}
                                    aria-label="Assign to centre"
                                    className={`text-xs border rounded-xl py-1.5 px-3.5 disabled:opacity-50 transition-all w-40 cursor-pointer outline-none font-bold ${r.centreId
                                        ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/15'
                                        : 'bg-white/5 border-outline-variant/10 text-slate-400 hover:border-outline-variant/30'
                                        }`}
                                >
                                    <option value="null" className="bg-[#1a1d23] text-slate-400">No Centre</option>
                                    {centres.map(c => (
                                        <option key={c.id} value={c.id} className="bg-[#1a1d23] text-white">{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
