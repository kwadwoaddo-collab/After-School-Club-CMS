import type { buildFinanceQueues } from './finance-workspace';
import { formatInvoiceDate, formatInvoicePeriod } from './invoice-display';

function cell(value: string) {
    // Untrusted family names and invoice references must not execute spreadsheet formulas.
    const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
}

/** Exports only the already authorised, filtered read projection supplied to the workspace. */
export function financeWorkspaceCsv(items: ReturnType<typeof buildFinanceQueues>['drafts']) {
    const rows = [['Family','Centre','Invoice','Billing period','Status','Total GBP','Remaining GBP','Due date']];
    for (const item of items) {
        const invoice = item.invoice;
        rows.push([
            invoice.parent ? `${invoice.parent.firstName} ${invoice.parent.lastName}` : 'Family account',
            invoice.centre?.name ?? '', invoice.invoiceNumber,
            formatInvoicePeriod(invoice.billingPeriodStart,invoice.billingPeriodEnd),
            invoice.status === 'draft' ? 'Draft — not issued' : item.paid > 0 ? 'Part-paid' : 'Issued — awaiting payment',
            item.amountValid ? (item.amount/100).toFixed(2) : '',
            invoice.status !== 'draft' && item.financialReliable ? (item.remaining/100).toFixed(2) : '',
            formatInvoiceDate(invoice.dueDate),
        ]);
    }
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
