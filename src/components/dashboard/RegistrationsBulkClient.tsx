'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Download, Loader2, X, Trash2, AlertTriangle, Mail, ClipboardList } from 'lucide-react';
import { assignRegistrationCentre, deleteRegistrations } from '@/app/dashboard/registrations/actions';
import { format, formatDistanceToNow } from 'date-fns';

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
    isFiltered?: boolean;
    totalCount?: number;
}

const FUNDING_LABELS: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    universal_credit: 'Universal Credit',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

export default function RegistrationsBulkClient({ rows, statusBadge, statusLabel, centres, isFiltered = false, totalCount }: Props) {
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

    const bulkSendEmail = async () => {
        if (selected.size === 0) return;
        setBulkLoading(true);
        setBulkMessage('');
        try {
            const ids = Array.from(selected);
            const res = await fetch('/api/register/bulk-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationIds: ids }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send emails');
            const parts = [`✓ Sent: ${data.sent}`];
            if (data.skipped > 0) parts.push(`Skipped (no email): ${data.skipped}`);
            if (data.failed > 0) parts.push(`Failed: ${data.failed}`);
            setBulkMessage(parts.join(' · '));
            setSelected(new Set());
        } catch (err: any) {
            setBulkMessage(err.message || 'Email sending failed.');
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
            <div className="w-full overflow-x-auto bg-card border border-border rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-secondary/30 border-b border-border">
                            <th className="w-[40px] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleAll}
                                    className="w-4 h-4 rounded accent-primary cursor-pointer mt-1"
                                    aria-label="Select all"
                                />
                            </th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle">Child Name</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle">Parent / Contact</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle">Status</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle">Centre</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle">Start Date</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle text-right">Submitted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center">
                                        <ClipboardList className="w-8 h-8 text-muted-foreground/30 mb-2" />
                                        <p>{isFiltered ? 'No matching registrations' : 'No registrations yet'}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map(r => {
                                const primary = r.registrationParents.find(p => p.isPrimary) ?? r.registrationParents[0];
                                const childNames = r.registrationChildren.map(k => `${k.submittedFirstName} ${k.submittedLastName}`).join(', ');
                                const isChecked = selected.has(r.id);

                                return (
                                    <tr key={r.id} className={`border-b border-border/50 hover:bg-secondary/40 transition-colors group ${isChecked ? 'bg-primary/5' : ''}`}>
                                        <td className="w-[40px] px-4 py-3 align-middle">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleOne(r.id)}
                                                className="w-4 h-4 rounded accent-primary cursor-pointer mt-1"
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <p className="font-semibold text-foreground truncate max-w-[200px]">
                                                {childNames || 'None'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <p className="text-sm font-semibold text-foreground">
                                                {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Unknown'}
                                            </p>
                                            {primary?.submittedEmail && (
                                                <p className="text-xs text-muted-foreground mt-0.5">{primary.submittedEmail}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <div className="flex items-center gap-2">
                                                {r.status === 'awaiting_confirmation' && (
                                                    <span className="relative flex h-2 w-2 flex-shrink-0">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
                                                    </span>
                                                )}
                                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge[r.status] || ''}`}>
                                                    {statusLabel[r.status] ?? r.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <select
                                                value={r.centreId || 'null'}
                                                onChange={e => handleCentreChange(r.id, e)}
                                                disabled={isPending}
                                                className="text-xs font-semibold bg-transparent border-none focus:ring-0 cursor-pointer hover:text-foreground text-muted-foreground transition-colors w-full p-0"
                                            >
                                                <option value="null">No Centre</option>
                                                {centres.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <span className="text-sm text-muted-foreground">
                                                {r.startDate ? format(new Date(r.startDate), 'dd MMM yyyy') : '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 align-middle text-right">
                                            <span className="text-sm font-medium text-foreground block text-right">
                                                {format(new Date(r.createdAt), 'dd MMM yyyy, HH:mm')}
                                            </span>
                                            {r.status === 'awaiting_confirmation' && (
                                                <span className="text-[10px] font-bold text-warning block mt-0.5 text-right">
                                                    Pending for {formatDistanceToNow(new Date(r.createdAt))}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Floating Bulk action bar */}
            {someSelected && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                    <span className="text-primary text-sm font-bold pl-2 pr-1">{selected.size} selected</span>
                    <div className="h-4 w-px bg-border mx-1" />

                    <button
                        onClick={() => bulkUpdateStatus('signed_up')}
                        disabled={bulkLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 text-success hover:bg-success/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Confirm all
                    </button>

                    <button
                        onClick={bulkSendEmail}
                        disabled={bulkLoading}
                        title="Send status notification email to selected parents"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Send Email
                    </button>

                    <button
                        onClick={() => bulkUpdateStatus('not_interested')}
                        disabled={bulkLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Mark not interested
                    </button>

                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-foreground hover:bg-secondary/80 rounded-xl text-sm font-semibold transition-all"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>

                    {/* Delete — two-step confirm */}
                    <div className="flex items-center gap-2">
                        {confirmingDelete ? (
                            <>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Delete {selected.size}?
                                </span>
                                <button
                                    onClick={bulkDelete}
                                    disabled={bulkLoading}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, delete'}
                                </button>
                                <button
                                    onClick={() => setConfirmingDelete(false)}
                                    disabled={bulkLoading}
                                    className="px-3 py-2 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setConfirmingDelete(true)}
                                disabled={bulkLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                            </button>
                        )}
                    </div>

                    <div className="h-4 w-px bg-border mx-1" />
                    
                    <button
                        onClick={() => { setSelected(new Set()); setConfirmingDelete(false); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors mr-1"
                        title="Clear selection"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {bulkMessage && (
                        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold bg-background/95 backdrop-blur-xl border shadow-xl ${bulkMessage.startsWith('✓') ? 'text-success border-success/20' : 'text-destructive border-destructive/20'}`}>
                            {bulkMessage}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
