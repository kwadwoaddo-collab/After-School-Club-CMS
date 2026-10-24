import { parseStrictDecimalToPence } from '@/features/finance/domain/payment-eligibility';

export interface FamilyInvoiceInput {
    id: string; invoiceNumber: string; organisationId: string; centreId: string; parentId: string;
    billingConfigId?: string | null; billingPeriodStart: Date | string | null; billingPeriodEnd: Date | string | null;
    dueDate: Date | string; createdAt: Date | string; amount: string; status: string; coveredChildrenJson?: unknown;
    payments: { amount: string; status: string | null }[];
}
export interface FamilyInvoiceSummary {
    id: string; invoiceNumber: string; periodStart: string | null; periodEnd: string | null;
    dueDate: string | null; createdAt: string | null; amountPence: number; paidPence: number; balancePence: number;
    status: string; paymentStatus: 'paid' | 'partially_paid' | 'unpaid' | 'not_issued' | 'void' | 'needs_review';
    overdue: boolean; historical?: boolean; needsReview: boolean; coveredChildren: unknown;
}
export type FamilyBillingAction = 'draft_review' | 'draft_due' | 'scheduled' | 'invoice_sent' | 'needs_setup' | 'paused' | 'data_review_required' | 'skipped';
export interface FamilyBillingSummary {
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    currentPeriodState: 'invoiced' | 'skipped' | 'no_invoice' | 'paused' | 'not_started';
    previousInvoice: FamilyInvoiceSummary | null;
    currentInvoices: FamilyInvoiceSummary[];
    nextInvoice: FamilyInvoiceSummary | null;
    drafts: FamilyInvoiceSummary[];
    outstandingInvoices: FamilyInvoiceSummary[];
    outstandingPence: number;
    outstandingReliable: boolean;
    history: FamilyInvoiceSummary[];
    needsReview: boolean;
    reviewReasons: string[];
    action: FamilyBillingAction;
}
function isoDay(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}
/** A read-only view: invoice coverage and verified allocations are authoritative, never run/creation order. */
export function buildFamilyBillingSummary(input: {
    organisationId: string; centreId: string; parentId: string; billingConfigId: string;
    invoices: FamilyInvoiceInput[]; now: Date; scheduleStart: string | null; draftCreationDate: string | null;
    currentPeriodStart?: string | null; currentPeriodEnd?: string | null; currentPeriodSkipped?: boolean;
    baseStatus: 'ready' | 'needs_setup' | 'paused' | 'skipped' | 'data_review_required' | 'invoice_sent';
}): FamilyBillingSummary {
    const today = isoDay(input.now)!;
    const reviewReasons: string[] = [];
    const history = input.invoices.filter(invoice => invoice.organisationId === input.organisationId &&
        invoice.centreId === input.centreId && invoice.parentId === input.parentId &&
        (!invoice.billingConfigId || invoice.billingConfigId === input.billingConfigId)).map(invoice => {
        const periodStart = isoDay(invoice.billingPeriodStart), periodEnd = isoDay(invoice.billingPeriodEnd);
        let moneyInvalid = false;
        const parseAmount = (value: string) => {
            try { return parseStrictDecimalToPence(value); }
            catch { moneyInvalid = true; return 0; }
        };
        const amountPence = parseAmount(invoice.amount);
        const paidPence = invoice.payments.filter(payment => payment.status === 'verified')
            .reduce((sum, payment) => {
                const next = sum + parseAmount(payment.amount);
                if (!Number.isSafeInteger(next)) { moneyInvalid = true; return sum; }
                return next;
            }, 0);
        if (paidPence > amountPence) moneyInvalid = true;
        const balancePence = Math.max(0, amountPence - paidPence);
        const dueDate = isoDay(invoice.dueDate);
        const paymentStatus: FamilyInvoiceSummary['paymentStatus'] = invoice.status === 'void' ? 'void' :
            moneyInvalid ? 'needs_review' : invoice.status === 'draft' ? 'not_issued' : balancePence === 0 ? 'paid' : paidPence > 0 ? 'partially_paid' : 'unpaid';
        const needsReview = moneyInvalid || !periodStart || !periodEnd || periodEnd < periodStart || !dueDate ||
            (invoice.status === 'paid' && balancePence > 0) || (invoice.status === 'draft' && paidPence > 0);
        if (needsReview) reviewReasons.push(`${invoice.invoiceNumber}: dates or payment status need review.`);
        return { id: invoice.id, invoiceNumber: invoice.invoiceNumber, periodStart, periodEnd, dueDate,
            createdAt: isoDay(invoice.createdAt), amountPence, paidPence, balancePence, status: invoice.status,
            paymentStatus, overdue: invoice.status !== 'draft' && invoice.status !== 'void' && balancePence > 0 && !!dueDate && dueDate < today,
            historical: !!periodEnd && periodEnd < today, needsReview, coveredChildren: invoice.coveredChildrenJson ?? null };
    }).sort((a, b) => (b.periodStart ?? '').localeCompare(a.periodStart ?? '') || a.invoiceNumber.localeCompare(b.invoiceNumber));
    const valid = history.filter(invoice => invoice.periodStart && invoice.periodEnd && invoice.periodEnd >= invoice.periodStart);
    const active = valid.filter(invoice => invoice.status !== 'void');
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
        if (input.invoices.find(invoice => invoice.id === active[i].id)?.billingConfigId === input.billingConfigId &&
            input.invoices.find(invoice => invoice.id === active[j].id)?.billingConfigId === input.billingConfigId &&
            active[i].periodStart! <= active[j].periodEnd! && active[j].periodStart! <= active[i].periodEnd!) {
            active[i].needsReview = active[j].needsReview = true;
            reviewReasons.push(`${active[i].invoiceNumber} and ${active[j].invoiceNumber}: overlapping billing periods.`);
        }
    }
    const completed = valid.filter(invoice => invoice.periodEnd! < today);
    const latestCompletedStart = completed[0]?.periodStart;
    const previousInvoice = completed.find(invoice => invoice.periodStart === latestCompletedStart && invoice.status !== 'void') ?? completed[0] ?? null;
    const currentInvoices = valid.filter(invoice => invoice.periodStart! <= today && invoice.periodEnd! >= today);
    const nextInvoice = active.filter(invoice => invoice.periodStart! > today).sort((a, b) => a.periodStart!.localeCompare(b.periodStart!))[0] ?? null;
    const drafts = history.filter(invoice => invoice.status === 'draft').sort((a, b) => (a.periodStart ?? '').localeCompare(b.periodStart ?? ''));
    const outstandingInvoices = history.filter(invoice => invoice.status !== 'draft' && invoice.status !== 'void' && invoice.balancePence > 0)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    const scheduleCovered = active.some(invoice => invoice.periodStart === input.scheduleStart);
    let action: FamilyBillingAction;
    if (input.baseStatus === 'paused' || input.baseStatus === 'needs_setup' || input.baseStatus === 'skipped' || input.baseStatus === 'data_review_required') action = input.baseStatus;
    else if (reviewReasons.length) action = 'data_review_required';
    else if (drafts.length) action = 'draft_review';
    else if (scheduleCovered) action = 'invoice_sent';
    else if (!input.scheduleStart || !input.draftCreationDate) {
        action = 'data_review_required';
        reviewReasons.push('The next billing schedule needs review before preparing another draft.');
    }
    else action = input.draftCreationDate.slice(0, 10) <= today ? 'draft_due' : 'scheduled';
    const currentPeriodStart = isoDay(input.currentPeriodStart);
    const currentPeriodEnd = isoDay(input.currentPeriodEnd);
    const currentPeriodState = input.baseStatus === 'paused' ? 'paused' : currentInvoices.some(invoice => invoice.status !== 'void') ? 'invoiced' : currentPeriodStart && currentPeriodStart > today ? 'not_started' : input.currentPeriodSkipped ? 'skipped' : 'no_invoice';
    let outstandingPence = 0;
    let outstandingReliable = !history.some(invoice => invoice.paymentStatus === 'needs_review');
    for (const invoice of outstandingInvoices) {
        const next = outstandingPence + invoice.balancePence;
        if (!Number.isSafeInteger(next)) {
            reviewReasons.push('The total outstanding amount exceeds the supported range; review individual invoices.');
            action = 'data_review_required';
            outstandingReliable = false;
            outstandingPence = 0;
            break;
        }
        outstandingPence = next;
    }
    return { currentPeriodStart, currentPeriodEnd, currentPeriodState, previousInvoice, currentInvoices, nextInvoice, drafts, outstandingInvoices,
        outstandingPence, outstandingReliable, history,
        needsReview: reviewReasons.length > 0, reviewReasons, action };
}
