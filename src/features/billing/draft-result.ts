export class DraftEnrolmentReviewError extends Error {
    constructor(public readonly childIds: string[]) { super('Billing requires confirmed signed-up, active students with reviewed fees and dates for the whole billing period. Review registration, pause/restart dates and family coverage first.'); }
}
export type DraftProblem = { title: string; message: string; reviewEnrolment?: boolean; childIds?: string[]; reference?: string };
export async function captureDraftResult<T>(operation: () => Promise<T>, report: (error: unknown) => string): Promise<{ ok: true; data: T } | { ok: false; problem: DraftProblem }> {
    try { return { ok: true, data: await operation() }; }
    catch (error) {
        if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_')) throw error;
        const message = error instanceof Error ? error.message : '';
        if (error instanceof DraftEnrolmentReviewError || message === 'Billing requires confirmed signed-up, active students with reviewed fees and dates for the whole billing period. Review registration, pause/restart dates and family coverage first.') {
            return { ok: false, problem: { title: 'Review enrolment before creating this draft', message: 'The selected period includes an enrolment or billing-review restriction. Open the student profile below and review confirmation, pause/restart history and the agreed fee dates. Correcting the original enrolment start date does not clear a later pause or restart hold.', reviewEnrolment: true, childIds: error instanceof DraftEnrolmentReviewError ? error.childIds : undefined } };
        }
        if (['Unauthorized','Unauthorized: No access to this centre','Unauthorized: Only Org Owner and Centre Managers can generate invoices'].includes(message)) return { ok: false, problem: { title: 'You cannot generate this draft', message: 'Sign in as an Owner or a Manager with access to this centre, then review the current billing plan.' } };
        if (message === 'Billing config not found' || message === 'Billing config is not active') return { ok: false, problem: { title: 'Review the current billing plan', message: 'Reload the family profile and check that its billing plan is available and active.' } };
        if (message.startsWith('Cannot generate invoice: billing cycle ') && message.includes(' is skipped (')) return { ok: false, problem: { title: 'This billing period is skipped', message: 'Review the skipped cycle before preparing a draft. No automatic replacement invoice has been created.' } };
        if (message === 'The selected billing period overlaps an existing family invoice. Review coverage before creating another draft; no automatic proration or credit has been applied.') return { ok: false, problem: { title: 'An invoice already overlaps this period', message: 'Check the family ledger and the existing invoice dates before preparing another draft.' } };
        return { ok: false, problem: { title: 'Draft creation not confirmed', message: 'Your entries are still here. Check the family ledger before retrying because a draft may already have been created. Reload the page if the result is unclear.', reference: report(error) } };
    }
}
