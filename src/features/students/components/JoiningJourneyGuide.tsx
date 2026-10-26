import Link from 'next/link';
/** Explanations only: booking intent never confirms enrolment or starts billing. */
export default function JoiningJourneyGuide() {
    return <details className="rounded-md border border-border px-4 py-3 text-sm text-foreground">
        <summary className="cursor-pointer font-medium">How joining works</summary>
        <ol className="mt-3 space-y-2 list-decimal pl-5 text-muted-foreground">
            <li><strong className="text-foreground">Assessment booked / attended:</strong> record what happened at the appointment.</li>
            <li><strong className="text-foreground">Joining requested:</strong> the family intends to join. Share the registration form; this is not confirmation.</li>
            <li><strong className="text-foreground">Form received — awaiting confirmation:</strong> review the submitted details and confirm the family really joined in <Link href="/dashboard/registrations?status=awaiting_confirmation" className="text-primary underline underline-offset-4">Registrations</Link>.</li>
            <li><strong className="text-foreground">Joining confirmed:</strong> only explicitly confirmed children are eligible for billing, subject to billing setup and their agreed start date. Existing students can use the separate existing-enrolment confirmation.</li>
        </ol>
        <p className="mt-3 text-muted-foreground">Pause, stop and restart attendance for each child from their Student profile. Records and existing balances are retained. This guide changes no status automatically.</p>
    </details>;
}
