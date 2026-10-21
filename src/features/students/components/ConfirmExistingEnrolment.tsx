'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function ConfirmExistingEnrolment({ childId }: { childId: string }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    return <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm text-foreground">No registration is linked. Prospects are retained for follow-up and excluded from billing until enrolment is confirmed.</p>
        <Button variant="outline" onClick={() => setOpen(!open)}>Confirm existing enrolled student</Button>
        {open && <form className="space-y-3" onSubmit={async e => {
            e.preventDefault(); setBusy(true); setError('');
            const data = new FormData(e.currentTarget);
            try {
                const response = await fetch(`/api/students/${childId}/confirm-enrolment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: data.get('reason'), startDate: data.get('startDate') }) });
                if (!response.ok) throw new Error((await response.json()).error || 'Confirmation failed');
                setOpen(false); router.refresh();
            } catch (err) { setError(err instanceof Error ? err.message : 'Confirmation failed'); } finally { setBusy(false); }
        }}>
            <label className="block text-sm text-foreground">Agreed start date<input name="startDate" type="date" required className="block rounded border border-border bg-background p-2" /></label>
            <label className="block text-sm text-foreground">Reason for existing enrolment<textarea name="reason" required minLength={5} maxLength={1000} className="block w-full rounded border border-border bg-background p-2" /></label>
            <p className="text-xs text-muted-foreground">This confirms eligibility only. Configure the agreed billing start date and fees separately; no invoice is created by this action.</p>
            <Button type="submit" disabled={busy}>{busy ? 'Confirming…' : 'Confirm enrolled'}</Button>
        </form>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    </section>;
}
