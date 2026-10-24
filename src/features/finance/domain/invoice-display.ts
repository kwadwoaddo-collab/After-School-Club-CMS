/** Read-only labels for the invoice list. Never changes an invoice or allocation. */
export function formatInvoiceDate(value: string | Date | null | undefined): string {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date) : 'Not recorded';
}
export function formatInvoicePeriod(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
    if (!start || !end) return 'Period missing';
    const a = new Date(start), b = new Date(end);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b < a) return 'Check period';
    const first = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',...(a.getUTCFullYear() !== b.getUTCFullYear() ? {year:'numeric' as const} : {}),timeZone:'UTC'}).format(a);
    return `${first} – ${formatInvoiceDate(b)}`;
}
function pence(value: string | number): number | null {
    const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) return null;
    const result = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2,'0'));
    return Number.isSafeInteger(result) ? result : null;
}
export function invoiceBalanceLabel(invoice: {amount:string|number;status:string;payments?:{amount:string|number;status?:string|null}[]}): string {
    const amount = pence(invoice.amount);
    if (amount === null) return 'Check amounts';
    if (invoice.status === 'void') return 'Void — not due';
    if (invoice.status === 'draft') return 'Not issued';
    if (!invoice.payments || invoice.payments.some(payment => !payment.status)) return 'Check payments';
    let paid = 0;
    for (const payment of invoice.payments) {
        if (payment.status !== 'verified') continue;
        const value = pence(payment.amount);
        if (value === null || !Number.isSafeInteger(paid + value)) return 'Check payments';
        paid += value;
    }
    if (paid > amount || (invoice.status === 'paid' && paid !== amount)) return 'Check payments';
    const remaining = new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format((amount-paid)/100);
    return `Remaining ${remaining}`;
}
