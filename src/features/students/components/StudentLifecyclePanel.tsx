'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import EnrolmentStartDate from './EnrolmentStartDate';
import { Badge } from '@/components/ui/Badge';

type Event = { id: string; status: 'active' | 'paused' | 'stopped'; effectiveDate: string; reason: string; expectedRestartDate: string | null; nextContactDate: string | null; feeReviewConfirmed: boolean; billingReviewedFrom?: string | null; createdAt: string };
type Contact = { id: string; createdAt: string; contactedAt: string; notes: string; nextContactDate: string | null };

const STOP_REASON_PRESETS = [
    'Left centre',
    'Moved school',
    'Schedule change',
    'Finished programme',
] as const;

export function formatLifecycleShortDate(dateStr?: string | null): string {
    if (!dateStr) return '';
    const parsed = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

export default function StudentLifecyclePanel({
    childId,
    events,
    contacts,
    today,
    canChangeStatus,
    confirmed,
    enrolmentStart,
    effectiveDate,
    reason,
}: {
    childId: string;
    events: Event[];
    contacts: Contact[];
    today: string;
    canChangeStatus: boolean;
    confirmed: boolean;
    enrolmentStart?: { date: string | null; version: string | null };
    effectiveDate?: string | null;
    reason?: string | null;
}) {
    const router = useRouter();
    const current = events.find(event => event.effectiveDate <= today);
    const scheduled = events.filter(event => event.effectiveDate > today);
    const status = current?.status ?? 'active';
    const resolvedEffectiveDate = effectiveDate ?? current?.effectiveDate ?? null;
    const resolvedReason = reason ?? current?.reason ?? null;
    const nextContactDate = [...events.map(event => ({ createdAt: event.createdAt, date: event.nextContactDate })), ...contacts.map(contact => ({ createdAt: contact.createdAt, date: contact.nextContactDate }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.date;
    const [mode, setMode] = useState<'status' | 'contact' | 'stop' | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<'active' | 'paused' | 'stopped'>('paused');
    const [stopDate, setStopDate] = useState(today);
    const [stopPreset, setStopPreset] = useState<string>('');
    const [stopNote, setStopNote] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const inputClass = 'mt-1 block w-full rounded-lg border border-border bg-background p-2 text-foreground';

    const handleQuickReactivate = async () => {
        setBusy(true);
        setError('');
        try {
            const response = await fetch(`/api/students/${childId}/lifecycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'status',
                    status: 'active',
                    effectiveDate: today,
                    reason: 'Reactivated by staff',
                    feeReviewConfirmed: true,
                }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Could not reactivate student');
            setMode(null);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not reactivate student');
        } finally {
            setBusy(false);
        }
    };

    return <section id="enrolment-follow-up" className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Enrolment and follow-up</h2>
            {status === 'stopped' ? (
                <Badge variant="default" className="tabular-nums">
                    {resolvedEffectiveDate ? `Stopped · ${formatLifecycleShortDate(resolvedEffectiveDate)}` : 'Stopped'}
                </Badge>
            ) : (
                <Badge variant={!confirmed ? 'default' : status === 'active' ? 'success' : 'warning'}>
                    {!confirmed ? 'Joining not yet confirmed' : status === 'active' ? 'Active attendance' : 'Paused'}
                </Badge>
            )}
        </div>
        {enrolmentStart && <EnrolmentStartDate childId={childId} date={enrolmentStart.date} version={enrolmentStart.version} today={today} canEdit={canChangeStatus && confirmed} />}
        {(current || (status === 'stopped' && (resolvedEffectiveDate || resolvedReason))) && (
            <p className="text-sm text-muted-foreground tabular-nums">
                Effective {current?.effectiveDate ?? resolvedEffectiveDate}: {current?.reason ?? resolvedReason}
                {current?.expectedRestartDate ? ` · Expected restart ${current.expectedRestartDate} (reminder only)` : ''}
            </p>
        )}
        {confirmed && status === 'active' && current && !current.feeReviewConfirmed && <p role="status" className="text-sm text-warning">Enrolment is active. Billing remains on hold until an Owner or Manager reviews the actual fee and agreed restart date in Billing configuration. No catch-up invoices are created.</p>}
        {confirmed && status === 'active' && current?.feeReviewConfirmed && current.billingReviewedFrom && current.billingReviewedFrom > today && <p role="status" className="text-sm text-warning">Enrolment is active. The reviewed billing start is {current.billingReviewedFrom}; earlier restart-period invoices remain blocked.</p>}
        {scheduled.length > 0 && <div className="space-y-1">{scheduled.map(event => <p key={event.id} className="text-sm text-muted-foreground">Scheduled: {event.status} from {event.effectiveDate}. {event.reason}</p>)}</div>}
        <p className="text-sm text-muted-foreground">Last contact: {contacts[0] ? new Date(contacts[0].contactedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : 'Not yet recorded'}. Contact logging records a conversation you have already had; it sends no message.</p>
        {nextContactDate && <p className="text-sm text-foreground">Next call / follow-up: {nextContactDate}{nextContactDate <= today ? ' · Due' : ''}</p>}
        <div className="flex flex-wrap gap-2">
            {canChangeStatus && status !== 'stopped' && (
                <Button
                    variant="destructive"
                    onClick={() => {
                        setStopDate(today);
                        setStopPreset('');
                        setStopNote('');
                        setMode(mode === 'stop' ? null : 'stop');
                        setError('');
                    }}
                >
                    Stop student
                </Button>
            )}
            {canChangeStatus && status === 'stopped' && (
                <Button variant="default" disabled={busy} onClick={handleQuickReactivate}>
                    {busy ? 'Reactivating…' : 'Reactivate student'}
                </Button>
            )}
            {canChangeStatus && confirmed && <Button variant="outline" onClick={() => { setMode(mode === 'status' ? null : 'status'); setError(''); }}>Change enrolment status</Button>}
            <Button variant="outline" onClick={() => { setMode(mode === 'contact' ? null : 'contact'); setError(''); }}>Log contacted / next call</Button>
            <Button variant="ghost" asChild><Link href="/dashboard/students?status=follow-ups">View follow-ups</Link></Button>
        </div>
        {mode === 'stop' && (
            <form
                key="stop"
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
                onSubmit={async event => {
                    event.preventDefault();
                    setBusy(true);
                    setError('');
                    const composedReason = [stopPreset, stopNote.trim()].filter(Boolean).join(' — ') || 'Marked as stopped by staff';
                    try {
                        const response = await fetch(`/api/students/${childId}/lifecycle`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'status',
                                status: 'stopped',
                                effectiveDate: stopDate || today,
                                reason: composedReason,
                            }),
                        });
                        if (!response.ok) throw new Error((await response.json()).error || 'Could not stop student');
                        setMode(null);
                        router.refresh();
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not stop student');
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-sm font-medium text-foreground">
                        Date stopped
                        <input
                            name="stopEffectiveDate"
                            type="date"
                            required
                            value={stopDate}
                            onChange={event => setStopDate(event.target.value)}
                            className={`${inputClass} tabular-nums`}
                        />
                    </label>
                    <label className="block text-sm font-medium text-foreground">
                        Optional note
                        <input
                            name="stopNote"
                            type="text"
                            value={stopNote}
                            onChange={event => setStopNote(event.target.value)}
                            placeholder="Optional reason or note…"
                            className={inputClass}
                        />
                    </label>
                </div>
                <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-muted-foreground">Quick reason (optional)</span>
                    <div className="flex flex-wrap gap-1.5">
                        {STOP_REASON_PRESETS.map(preset => (
                            <Button
                                key={preset}
                                type="button"
                                size="sm"
                                variant={stopPreset === preset ? 'default' : 'outline'}
                                onClick={() => setStopPreset(stopPreset === preset ? '' : preset)}
                            >
                                {preset}
                            </Button>
                        ))}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    Stopping excludes this student from future billing cycles, registers, and active student counts while preserving all historical attendance and issued invoices.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="destructive" disabled={busy}>
                        {busy ? 'Stopping…' : 'Confirm stopped'}
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setMode(null)}>
                        Cancel
                    </Button>
                </div>
            </form>
        )}
        {(mode === 'status' || mode === 'contact') && <form key={mode} className="space-y-3 border-t border-border pt-4" onSubmit={async event => {
            event.preventDefault(); setBusy(true); setError('');
            const form = new FormData(event.currentTarget);
            const rawReason = String(form.get('reason') ?? '').trim();
            const body = mode === 'status' ? { action: 'status', status: selectedStatus, effectiveDate: form.get('effectiveDate'), reason: rawReason || (selectedStatus === 'stopped' ? 'Marked as stopped by staff' : selectedStatus === 'active' ? 'Reactivated by staff' : ''), expectedRestartDate: form.get('expectedRestartDate') || null, nextContactDate: form.get('nextContactDate') || null } : { action: 'contact', notes: form.get('notes'), nextContactDate: form.get('nextContactDate') || null };
            try { const response = await fetch(`/api/students/${childId}/lifecycle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) throw new Error((await response.json()).error || 'Could not save'); setMode(null); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save'); } finally { setBusy(false); }
        }}>
            {mode === 'status' ? <>
                <label className="block text-sm text-foreground">New status<select value={selectedStatus} onChange={event => setSelectedStatus(event.target.value as typeof selectedStatus)} className={inputClass}><option value="paused">Paused</option><option value="stopped">Stopped</option><option value="active" disabled={status === 'active' && !scheduled.some(event => event.status !== 'active')}>Reactivate / active</option></select></label>
                <label className="block text-sm text-foreground">{selectedStatus === 'active' ? 'Agreed restart date' : 'Effective date'}<input name="effectiveDate" type="date" required defaultValue={today} className={`${inputClass} tabular-nums`} /></label>
                <label className="block text-sm text-foreground">Reason<textarea name="reason" minLength={selectedStatus === 'paused' ? 5 : undefined} maxLength={2000} required={selectedStatus === 'paused'} placeholder={selectedStatus === 'stopped' ? 'Optional (defaults to Marked as stopped by staff)' : undefined} className={inputClass} /></label>
                {selectedStatus === 'paused' && <label className="block text-sm text-foreground">Expected restart date (optional reminder)<input name="expectedRestartDate" type="date" className={`${inputClass} tabular-nums`} /></label>}
                <p className="text-xs text-muted-foreground">Existing invoices and payments are preserved. Reactivation requires a separate fee and billing-start review before automatic drafts resume. An expected restart date never reactivates a student automatically.</p>
            </> : <label className="block text-sm text-foreground">Contact outcome / notes<textarea name="notes" minLength={5} maxLength={2000} required className={inputClass} /></label>}
            <label className="block text-sm text-foreground">Next call / follow-up date (optional)<input name="nextContactDate" type="date" className={`${inputClass} tabular-nums`} /></label>
            <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : mode === 'status' ? 'Save status' : 'Record contact'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Cancel</Button></div>
        </form>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <details><summary className="cursor-pointer text-sm text-foreground">Status and contact history ({events.length + contacts.length})</summary><ul className="mt-3 space-y-2 text-sm text-muted-foreground break-words">{events.map(event => <li key={event.id}>{event.effectiveDate} · {event.status} · {event.reason} · Recorded {new Date(event.createdAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</li>)}{contacts.map(contact => <li key={contact.id}>{new Date(contact.contactedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })} · {contact.notes}{contact.nextContactDate ? ` · Next call ${contact.nextContactDate}` : ''}</li>)}</ul></details>
    </section>;
}
