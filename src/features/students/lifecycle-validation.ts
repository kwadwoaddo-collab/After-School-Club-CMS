import { z } from 'zod';
import { isValidEnrolmentStartDate } from '@/lib/enrolment/start-date';
const date = z.string().refine(isValidEnrolmentStartDate, 'Use a real calendar date');
const optionalDate = date.nullable().optional();

export function defaultLifecycleReason(status: 'active' | 'paused' | 'stopped', reason?: string | null): string {
    const trimmed = (reason ?? '').trim();
    if (trimmed.length >= 5) return trimmed;
    if (status === 'stopped') return 'Marked as stopped by staff';
    if (status === 'active') return 'Reactivated by staff';
    return 'Paused by staff';
}

export const lifecycleInput = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('status'),
        status: z.enum(['active', 'paused', 'stopped']),
        effectiveDate: date,
        reason: z.string().max(2000).optional(),
        expectedRestartDate: optionalDate,
        nextContactDate: optionalDate,
        feeReviewConfirmed: z.boolean().optional(),
    })
        .transform(value => ({
            ...value,
            reason:
                value.status === 'paused' && value.reason !== undefined && value.reason.trim().length < 5
                    ? value.reason.trim()
                    : defaultLifecycleReason(value.status, value.reason),
        }))
        .refine(value => value.reason.length >= 5, {
            message: 'Reason must be at least 5 characters',
            path: ['reason'],
        })
        .refine(value => !value.expectedRestartDate || value.expectedRestartDate >= value.effectiveDate, {
            message: 'Expected restart cannot precede the effective date',
            path: ['expectedRestartDate'],
        }),
    z.object({ action: z.literal('contact'), notes: z.string().trim().min(5).max(2000), nextContactDate: optionalDate }),
]);
