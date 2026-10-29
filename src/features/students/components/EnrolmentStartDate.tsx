'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function EnrolmentStartDate({ childId, date, version, today, canEdit }: { childId: string; date: string | null; version: string | null; today: string; canEdit: boolean }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [correctionId, setCorrectionId] = useState('');
    const dateLabel = date ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }) : 'Not recorded';
    return <div className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-foreground"><span className="font-semibold">Enrolment start date:</span> {dateLabel}</p>{canEdit && !editing && <Button variant="outline" onClick={() => { setEditing(true); setError(''); setCorrectionId(crypto.randomUUID()); }}>Edit start date</Button>}</div>
        {editing && <form className="space-y-3" onSubmit={async event => {
            event.preventDefault(); if (busy) return; setBusy(true); setError('');
            const form = new FormData(event.currentTarget);
            try {
                const response = await fetch(`/api/students/${childId}/start-date`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate: form.get('startDate'), reason: form.get('reason'), expectedVersion: version, correctionId }) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'The correction was not confirmed. Reload the profile.');
                setEditing(false); router.refresh();
            } catch (err) { setError(err instanceof Error ? err.message : 'The correction was not confirmed. Reload the profile.'); } finally { setBusy(false); }
        }}>
            <p className="text-sm text-muted-foreground">Correct the original attendance start date. This records an audit entry; it keeps status history, billing dates and fees unchanged. It does not create invoices, send emails or clear billing-review holds.</p>
            <label className="block text-sm font-medium">Actual enrolment start date<input autoFocus name="startDate" type="date" min="1900-01-01" max={today} required defaultValue={date ?? ''} disabled={busy} className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-background p-3 text-foreground" /></label>
            <label className="block text-sm font-medium">Reason for correction<textarea name="reason" required minLength={5} maxLength={1000} rows={3} disabled={busy} className="mt-1 block w-full rounded-lg border border-border bg-background p-3 text-foreground" /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save start date'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button></div>
        </form>}
    </div>;
}
