import type { FinanceInvoice } from '../components/FinanceDataGridClient';
function parseStrictDecimalToPence(value: string): number {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Invalid amount');
    const [whole, fraction = ''] = value.split('.');
    const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(amount)) throw new Error('Invalid amount');
    return amount;
}

export type WorkspaceInvoice = Omit<FinanceInvoice, 'payments'> & { billingConfigId?: string | null; payments?: (NonNullable<FinanceInvoice['payments']>[number] & { reversedAt?: string | Date | null })[] };
export function isFinanceWorkspaceView(params: {view?: string; status?: string; create?: string}) {
    return !['former','history','families'].includes(params.view ?? '') && params.status !== 'paid' && !['1','true'].includes(params.create ?? '');
}
export function day(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}
export function inspectInvoice(invoice: WorkspaceInvoice, today: string) {
    const reasons: string[] = [];
    let amount = 0, paid = 0, amountValid = true;
    try { amount = parseStrictDecimalToPence(String(invoice.amount)); } catch { amountValid = false; reasons.push('Invoice amount needs checking.'); }
    if (!invoice.payments) reasons.push('Payment records could not be checked.');
    for (const payment of invoice.payments ?? []) {
        if (!payment.status) { reasons.push('A payment has no verification status.'); continue; }
        if (!['verified','pending','failed','reversed'].includes(payment.status)) reasons.push('A payment has an unknown verification status.');
        if (payment.status !== 'verified' || payment.reversedAt) continue;
        try {
            paid += parseStrictDecimalToPence(String(payment.amount));
            if (!Number.isSafeInteger(paid)) reasons.push('Payment total needs checking.');
        } catch { reasons.push('A payment amount needs checking.'); }
    }
    if (paid > amount || (invoice.status === 'paid' && paid !== amount) || (invoice.status === 'draft' && paid > 0)) reasons.push('Invoice and payment totals need checking.');
    const financialReliable = reasons.length === 0;
    const start = day(invoice.billingPeriodStart), end = day(invoice.billingPeriodEnd), due = day(invoice.dueDate);
    if (invoice.status !== 'paid') {
        if (!start || !end || end < start) reasons.push('Billing period is missing or invalid.');
        if (!due) reasons.push('Due date needs checking.');
    }
    if (invoice.needsBillingReview) reasons.push('Attendance or registration needs review before issuing.');
    return { amount, amountValid, financialReliable, paid, remaining: amount - paid, reasons, start, end, due,
        upcoming: !!start && start > today, historical: !!end && end < today,
        overdue: invoice.status !== 'draft' && !!due && due < today,
        pending: (invoice.payments ?? []).some(payment => payment.status === 'pending' && !payment.reversedAt),
    };
}
export function buildFinanceQueues(invoices: WorkspaceInvoice[], today: string) {
    const unique = [...new Map(invoices.map(invoice => [invoice.id, invoice])).values()];
    const inspected = unique.filter(invoice => invoice.status !== 'void').map(invoice => ({ invoice, ...inspectInvoice(invoice, today) }));
    // Multiple invoices for different children can be legitimate. Flag only a shared billing configuration.
    for (const item of inspected) {
        if (item.invoice.status !== 'draft' || !item.invoice.billingConfigId || !item.start || !item.end) continue;
        if (inspected.some(other => other.invoice.id !== item.invoice.id && other.invoice.billingConfigId === item.invoice.billingConfigId && other.invoice.centreId === item.invoice.centreId && other.invoice.parentId === item.invoice.parentId && other.start && other.end && other.start <= item.end! && other.end >= item.start!)) item.reasons.push('Another invoice overlaps this billing period.');
    }
    const drafts = inspected.filter(item => item.invoice.status === 'draft').sort((a,b) => (a.start ?? '').localeCompare(b.start ?? '') || a.invoice.id.localeCompare(b.invoice.id));
    const payments = inspected.filter(item => ['sent','partially_paid'].includes(item.invoice.status) && item.remaining > 0 && item.financialReliable).sort((a,b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.invoice.id.localeCompare(b.invoice.id));
    const attention = inspected.filter(item => item.reasons.length);
    return { drafts, payments, attention };
}
export function adjacentInvoices(selected: WorkspaceInvoice, invoices: WorkspaceInvoice[]) {
    const start = day(selected.billingPeriodStart), end = day(selected.billingPeriodEnd);
    const related = invoices.filter(invoice => invoice.id !== selected.id && invoice.status !== 'void' && invoice.parentId === selected.parentId && invoice.centreId === selected.centreId && (!selected.billingConfigId || !invoice.billingConfigId || invoice.billingConfigId === selected.billingConfigId));
    return {
        previous: related.filter(invoice => start && day(invoice.billingPeriodEnd) && day(invoice.billingPeriodEnd)! < start).sort((a,b) => day(b.billingPeriodEnd)!.localeCompare(day(a.billingPeriodEnd)!))[0],
        next: related.filter(invoice => end && day(invoice.billingPeriodStart) && day(invoice.billingPeriodStart)! > end).sort((a,b) => day(a.billingPeriodStart)!.localeCompare(day(b.billingPeriodStart)!))[0],
    };
}
