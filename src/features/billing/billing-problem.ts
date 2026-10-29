/** Public messages only. Never interpolate raw server, database or provider text. */
export type BillingProblem = {
    code: 'ENROLMENT_REVIEW' | 'PERMISSION' | 'FEE' | 'COVERAGE' | 'ALREADY_CONFIGURED' | 'NOT_FOUND' | 'UNKNOWN';
    title: string;
    message: string;
    reviewEnrolment?: boolean;
    reference?: string;
};

export function billingProblem(error: unknown): BillingProblem {
    const message = error instanceof Error ? error.message : '';
    switch (message) {
        case 'One or more children are invalid or do not belong to this family/centre':
        case 'Billing requires confirmed signed-up, active students with reviewed fees and dates for the whole billing period. Review registration, pause/restart dates and family coverage first.':
            return { code: 'ENROLMENT_REVIEW', title: 'Review enrolment before saving billing', message: 'Check that each selected student is confirmed as enrolled, belongs to this family and centre, and is active on the billing start date. Confirm enrolment directly in this form or review enrolment on the student profile, then save billing.', reviewEnrolment: true };
        case 'Enter a valid agreed enrolment start date':
            return { code: 'ENROLMENT_REVIEW', title: 'Enter a valid enrolment start date', message: 'Choose a valid calendar date for the students’ agreed enrolment start date, then try again.', reviewEnrolment: true };
        case 'Enrolment start date cannot be after the billing start date':
            return { code: 'ENROLMENT_REVIEW', title: 'Check the enrolment start date', message: 'The agreed enrolment start date must be on or before the first billing period start date so each selected student is active when billing starts.', reviewEnrolment: true };
        case 'Enter a confirmation reason between 5 and 1000 characters':
            return { code: 'ENROLMENT_REVIEW', title: 'Enter a reason for enrolment confirmation', message: 'Enter a confirmation reason of at least 5 characters so the enrolment audit record is complete.', reviewEnrolment: true };
        case 'Unauthorized':
        case 'Unauthorized: No access to this centre':
        case 'Only an Owner or Manager can review family billing':
        case 'Only an Owner or Manager can review family billing and coverage':
        case 'Only an Owner or Manager can change billing status':
        case 'Only an Owner or Manager can confirm student enrolment':
            return { code: 'PERMISSION', title: 'You cannot update these billing settings', message: 'Ask an Owner or Manager with access to this centre to review the family’s billing. If your session has expired, sign in again.' };
        case 'Enter the agreed family fee before billing review':
            return { code: 'FEE', title: 'Enter the agreed monthly fee', message: 'Enter an amount greater than £0, then save again.' };
        case 'Select at least one confirmed signed-up student for billing':
        case 'Select at least one confirmed active student':
            return { code: 'COVERAGE', title: 'Choose a student to cover', message: 'Select at least one confirmed enrolled student for this family’s billing plan.' };
        case 'A billing config already exists for this family at this centre. Use update instead.':
            return { code: 'ALREADY_CONFIGURED', title: 'Billing is already set up for this family', message: 'Reload this profile to see the existing plan, then choose Edit billing settings. Do not create another plan.' };
        case 'Billing config not found':
            return { code: 'NOT_FOUND', title: 'This billing plan is no longer available', message: 'Reload the family profile to check the current plan. Ask your centre manager if it is still missing.' };
        default:
            return { code: 'UNKNOWN', title: 'Billing change not confirmed', message: 'Your entries are still here. Check the family’s saved billing plan before trying again, because the change may already have been saved. If you are unsure, ask your centre manager.' };
    }
}

export type BillingSettingsResult<T> = { ok: true; data: T } | { ok: false; problem: BillingProblem };

export async function captureBillingResult<T>(operation: () => Promise<T>, report: (error: unknown) => string): Promise<BillingSettingsResult<T>> {
    try { return { ok: true, data: await operation() }; }
    catch (error) {
        // Authentication redirects and framework control flow must reach Next unchanged.
        if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_')) throw error;
        const problem = billingProblem(error);
        if (problem.code === 'UNKNOWN') problem.reference = report(error);
        return { ok: false, problem };
    }
}
