/**
 * Canonical 4-state invoice collection & assessment-period aging model.
 *
 * Pure module (zero DB / server imports) safe for both server and client components.
 *
 * Visual & Policy Rules:
 * - Green (`paid`): Verified payments cover 100% of invoice total (`remainingPence === 0`).
 * - Blue / Sky (`upcoming`): Issued in advance, before the assessment period / due window begins (`today < yellowStart`).
 * - Yellow / Amber (`in_period`): Inside the active assessment period (`yellowStart <= today <= redCutoff`) with balance remaining.
 *   Tracked actively by finance staff, never branded "Overdue" to parents.
 * - Red / Rose (`overdue`): Past the end of the assessment period (`today > redCutoff`) with balance remaining.
 * - `draft`, `void`, and `needs_checking` remain distinct non-collection or exception states.
 */
import { parseStoredDecimalToPence, parseStrictDecimalToPence } from './payment-eligibility';

export type InvoiceCollectionStage =
    | 'void'
    | 'draft'
    | 'paid'
    | 'upcoming'
    | 'in_period'
    | 'overdue'
    | 'needs_checking';

export type InvoiceCollectionTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export interface InvoiceCollectionDatesInput {
    billingPeriodStart?: string | Date | null;
    billingPeriodEnd?: string | Date | null;
    dueDate?: string | Date | null;
}

export interface InvoiceCollectionPaymentInput {
    amount: string | number;
    status?: string | null;
    reversedAt?: string | Date | null;
    recordedAt?: string | Date | null;
}

export interface InvoiceCollectionInput extends InvoiceCollectionDatesInput {
    amount: string | number;
    status: string;
    payments?: InvoiceCollectionPaymentInput[] | null;
}

export interface ResolvedCollectionWindow {
    start: string | null;
    end: string | null;
    due: string | null;
    hasValidPeriod: boolean;
    hasAnyPeriodBound: boolean;
    hasInvalidPeriod: boolean;
    yellowStart: string | null;
    redCutoff: string | null;
}

export interface EvaluatedInvoiceCollectionState extends ResolvedCollectionWindow {
    stage: InvoiceCollectionStage;
    tone: InvoiceCollectionTone;
    financialReliable: boolean;
    reasons: string[];
    amountPence: number;
    paidPence: number;
    pendingPence: number;
    remainingPence: number;
    isPartPaid: boolean;
    hasPendingPayment: boolean;
    /** Explicit staff-facing label (never relies on color alone) */
    staffLabel: string;
    /** Compact staff badge text for tables/pills */
    staffBadgeLabel: string;
    /** Parent-facing label using "Assessment period" terminology */
    parentLabel: string;
    /** CSV / report status text */
    exportLabel: string;
}

/**
 * Formats a Date as YYYY-MM-DD in Europe/London business timezone.
 */
export function toLondonBusinessDate(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

/**
 * Extracts the canonical YYYY-MM-DD UTC date slice from an invoice date field.
 * Billing period bounds and due dates are stored as UTC midnight timestamps.
 */
export function invoiceUtcDay(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/**
 * Resolves the active payment window (`yellowStart` .. `redCutoff`) from an invoice's
 * assessment period and due date.
 *
 * - Standard recurring invoices (`due === start <= end`):
 *   `yellowStart = start` (Day 1 of assessment period), `redCutoff = end` (last day of assessment period).
 * - Custom `paymentDayOfMonth` within the period (`start < due <= end`):
 *   `yellowStart = due`, `redCutoff = end`.
 * - Extended `dueDate` after `periodEnd` (`due > end`):
 *   `yellowStart = start`, `redCutoff = due` (never overdue before stated due date).
 * - Ad-hoc / manual one-off invoices with no period (`start === null && end === null`):
 *   `yellowStart = due`, `redCutoff = due` (Upcoming before due date, Yellow on due date, Red after due date).
 */
export function resolveCollectionWindow(input: InvoiceCollectionDatesInput): ResolvedCollectionWindow {
    const start = invoiceUtcDay(input.billingPeriodStart);
    const end = invoiceUtcDay(input.billingPeriodEnd);
    const due = invoiceUtcDay(input.dueDate);

    const hasAnyPeriodBound = start !== null || end !== null;
    const hasValidPeriod = start !== null && end !== null && end >= start;
    const hasInvalidPeriod = hasAnyPeriodBound && !hasValidPeriod;

    if (hasInvalidPeriod) {
        return {
            start,
            end,
            due,
            hasValidPeriod: false,
            hasAnyPeriodBound,
            hasInvalidPeriod: true,
            yellowStart: null,
            redCutoff: null,
        };
    }

    if (hasValidPeriod) {
        const yellowStart = due && due > start! && due <= end! ? due : start!;
        const redCutoff = due && due > end! ? due : end!;
        return {
            start,
            end,
            due,
            hasValidPeriod: true,
            hasAnyPeriodBound: true,
            hasInvalidPeriod: false,
            yellowStart,
            redCutoff,
        };
    }

    // One-off / legacy invoice without assessment period bounds: fall back to dueDate
    return {
        start: null,
        end: null,
        due,
        hasValidPeriod: false,
        hasAnyPeriodBound: false,
        hasInvalidPeriod: false,
        yellowStart: due,
        redCutoff: due,
    };
}

/**
 * Resolves the aging stage for an issued, unpaid/part-paid invoice (`remaining > 0`).
 */
export function resolveOpenAgingStage(
    input: InvoiceCollectionDatesInput,
    todayLondonIso: string = toLondonBusinessDate(),
): 'upcoming' | 'in_period' | 'overdue' | 'needs_checking' {
    const win = resolveCollectionWindow(input);
    if (win.hasInvalidPeriod || !win.yellowStart || !win.redCutoff) {
        return 'needs_checking';
    }
    if (todayLondonIso > win.redCutoff) {
        return 'overdue';
    }
    if (todayLondonIso >= win.yellowStart) {
        return 'in_period';
    }
    return 'upcoming';
}

/**
 * Sorting priority for staff collection queues:
 * Red (`overdue`) -> Yellow (`in_period`) -> Blue (`upcoming`) -> `needs_checking` -> settled/other.
 */
export function collectionStagePriority(stage: InvoiceCollectionStage): number {
    switch (stage) {
        case 'overdue':
            return 0;
        case 'in_period':
            return 1;
        case 'upcoming':
            return 2;
        case 'needs_checking':
            return 3;
        case 'draft':
            return 4;
        case 'paid':
            return 5;
        case 'void':
            return 6;
    }
}

/**
 * WCAG AA compliant visual token presets for collection stage pills and inline text.
 * Always pair with an icon (`aria-hidden="true"`) and explicit label text (WCAG 1.4.1).
 */
export const COLLECTION_STAGE_STYLES: Record<
    InvoiceCollectionStage,
    { badge: string; text: string; tone: InvoiceCollectionTone }
> = {
    paid: {
        badge: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/25',
        text: 'text-emerald-700 dark:text-emerald-300',
        tone: 'success',
    },
    upcoming: {
        badge: 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border border-sky-500/25',
        text: 'text-sky-800 dark:text-sky-300',
        tone: 'info',
    },
    in_period: {
        badge: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30',
        text: 'text-amber-800 dark:text-amber-200',
        tone: 'warning',
    },
    overdue: {
        badge: 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/30',
        text: 'text-rose-700 dark:text-rose-300',
        tone: 'danger',
    },
    draft: {
        badge: 'bg-secondary text-muted-foreground border border-border',
        text: 'text-muted-foreground',
        tone: 'neutral',
    },
    void: {
        badge: 'bg-secondary/60 text-muted-foreground border border-border/60',
        text: 'text-muted-foreground',
        tone: 'neutral',
    },
    needs_checking: {
        badge: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30',
        text: 'text-amber-800 dark:text-amber-200',
        tone: 'warning',
    },
};

function buildLabelsForStage(params: {
    stage: InvoiceCollectionStage;
    isPartPaid: boolean;
    hasValidPeriod: boolean;
}): {
    staffLabel: string;
    staffBadgeLabel: string;
    parentLabel: string;
    exportLabel: string;
} {
    const { stage, isPartPaid, hasValidPeriod } = params;
    switch (stage) {
        case 'void':
            return {
                staffLabel: 'Void — not due',
                staffBadgeLabel: 'Void',
                parentLabel: 'Void',
                exportLabel: 'Void — not due',
            };
        case 'draft':
            return {
                staffLabel: 'Draft — not issued',
                staffBadgeLabel: 'Draft',
                parentLabel: 'Draft',
                exportLabel: 'Draft — not issued',
            };
        case 'needs_checking':
            return {
                staffLabel: 'Needs checking',
                staffBadgeLabel: 'Needs checking',
                parentLabel: 'Awaiting review',
                exportLabel: 'Needs checking',
            };
        case 'paid':
            return {
                staffLabel: 'Paid in full',
                staffBadgeLabel: 'Paid in full',
                parentLabel: 'Paid in full',
                exportLabel: 'Paid in full',
            };
        case 'upcoming':
            return {
                staffLabel: isPartPaid ? 'Upcoming · Part-paid' : 'Upcoming · Issued in advance',
                staffBadgeLabel: isPartPaid ? 'Upcoming · Part-paid' : 'Upcoming',
                parentLabel: isPartPaid ? 'Upcoming · Part-paid' : 'Upcoming',
                exportLabel: isPartPaid ? 'Upcoming — part-paid' : 'Upcoming — issued in advance',
            };
        case 'in_period':
            if (hasValidPeriod) {
                return {
                    staffLabel: isPartPaid ? 'In period · Part-paid' : 'In period · Due',
                    staffBadgeLabel: isPartPaid ? 'In period · Part-paid' : 'In period · Due',
                    parentLabel: isPartPaid ? 'Assessment period · Part-paid' : 'Assessment period · Payment due',
                    exportLabel: isPartPaid ? 'In period — part-paid' : 'In period — due',
                };
            }
            return {
                staffLabel: isPartPaid ? 'Due today · Part-paid' : 'Due today',
                staffBadgeLabel: isPartPaid ? 'Due today · Part-paid' : 'Due today',
                parentLabel: isPartPaid ? 'Due today · Part-paid' : 'Payment due today',
                exportLabel: isPartPaid ? 'Due today — part-paid' : 'Due today',
            };
        case 'overdue':
            if (hasValidPeriod) {
                return {
                    staffLabel: isPartPaid ? 'Overdue · Part-paid' : 'Overdue · Past period',
                    staffBadgeLabel: isPartPaid ? 'Overdue · Part-paid' : 'Overdue · Past period',
                    parentLabel: isPartPaid ? 'Overdue · Part-paid' : 'Overdue · Past assessment period',
                    exportLabel: isPartPaid ? 'Overdue — part-paid' : 'Overdue — past assessment period',
                };
            }
            return {
                staffLabel: isPartPaid ? 'Overdue · Part-paid' : 'Overdue',
                staffBadgeLabel: isPartPaid ? 'Overdue · Part-paid' : 'Overdue',
                parentLabel: isPartPaid ? 'Overdue · Part-paid' : 'Overdue',
                exportLabel: isPartPaid ? 'Overdue — part-paid' : 'Overdue',
            };
    }
}

/**
 * Full authoritative evaluation of an invoice's financial reliability and 4-state collection stage.
 *
 * When `options.strictPayments === false`, missing `payments` array falls back to `status`
 * (`paid` -> full amount paid, otherwise 0 paid) for lightweight surfaces that do not join payments.
 * By default (`strictPayments === true`), `payments` must be present and valid.
 */
export function evaluateInvoiceCollectionState(
    invoice: InvoiceCollectionInput,
    todayLondonIso: string = toLondonBusinessDate(),
    options?: { strictPayments?: boolean },
): EvaluatedInvoiceCollectionState {
    const strictPayments = options?.strictPayments ?? true;
    const win = resolveCollectionWindow(invoice);
    const reasons: string[] = [];

    let amountPence = 0;
    let amountValid = true;
    try {
        amountPence = parseStrictDecimalToPence(String(invoice.amount));
    } catch {
        amountValid = false;
        reasons.push('Invoice amount needs checking.');
    }

    let paidPence = 0;
    let pendingPence = 0;
    let hasPendingPayment = false;

    if (!invoice.payments) {
        if (strictPayments && invoice.status !== 'void') {
            reasons.push('Payment records could not be checked.');
        } else if (!strictPayments && invoice.status === 'paid' && amountValid) {
            paidPence = amountPence;
        }
    } else {
        for (const payment of invoice.payments) {
            if (!payment.status) {
                reasons.push('A payment has no verification status.');
                continue;
            }
            if (!['verified', 'pending', 'failed', 'reversed'].includes(payment.status)) {
                reasons.push('A payment has an unknown verification status.');
                continue;
            }
            if (payment.reversedAt || payment.status === 'reversed' || payment.status === 'failed') {
                continue;
            }
            if (payment.status === 'pending') {
                hasPendingPayment = true;
                pendingPence += Math.max(0, parseStoredDecimalToPence(payment.amount));
                continue;
            }
            try {
                paidPence += parseStrictDecimalToPence(String(payment.amount));
                if (!Number.isSafeInteger(paidPence)) {
                    reasons.push('Payment total needs checking.');
                }
            } catch {
                reasons.push('A payment amount needs checking.');
            }
        }
    }

    if (
        amountValid &&
        (paidPence > amountPence ||
            (invoice.status === 'paid' && paidPence !== amountPence) ||
            (invoice.status === 'draft' && paidPence > 0))
    ) {
        reasons.push('Invoice and payment totals need checking.');
    }

    const financialReliable = reasons.length === 0;
    const remainingPence = amountValid ? amountPence - paidPence : 0;
    const isPartPaid = financialReliable && paidPence > 0 && remainingPence > 0;

    let stage: InvoiceCollectionStage;
    if (invoice.status === 'void') {
        stage = 'void';
    } else if (!financialReliable) {
        stage = 'needs_checking';
    } else if (invoice.status === 'draft') {
        stage = 'draft';
    } else if (remainingPence === 0) {
        stage = 'paid';
    } else if (invoice.status === 'sent' || invoice.status === 'partially_paid') {
        stage = resolveOpenAgingStage(invoice, todayLondonIso);
    } else {
        stage = 'needs_checking';
    }

    const labels = buildLabelsForStage({
        stage,
        isPartPaid,
        hasValidPeriod: win.hasValidPeriod,
    });

    return {
        ...win,
        stage,
        tone: COLLECTION_STAGE_STYLES[stage].tone,
        financialReliable,
        reasons,
        amountPence,
        paidPence,
        pendingPence,
        remainingPence,
        isPartPaid,
        hasPendingPayment,
        ...labels,
    };
}
