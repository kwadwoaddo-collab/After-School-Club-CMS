import { z } from 'zod';
import { isValidEnrolmentStartDate } from '@/lib/enrolment/start-date';
const date = z.string().refine(isValidEnrolmentStartDate, 'Use a real calendar date');
const optionalDate = date.nullable().optional();
export const lifecycleInput = z.discriminatedUnion('action', [
    z.object({ action: z.literal('status'), status: z.enum(['active', 'paused', 'stopped']), effectiveDate: date, reason: z.string().trim().min(5).max(2000), expectedRestartDate: optionalDate, nextContactDate: optionalDate }).refine(value => !value.expectedRestartDate || value.expectedRestartDate >= value.effectiveDate, { message: 'Expected restart cannot precede the effective date', path: ['expectedRestartDate'] }),
    z.object({ action: z.literal('contact'), notes: z.string().trim().min(5).max(2000), nextContactDate: optionalDate }),
]);
