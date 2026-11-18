import type { buildFinanceQueues } from './finance-workspace';
import { formatInvoiceDate, formatInvoicePeriod } from './invoice-display';

function cell(value: string) {
    // Untrusted family names and invoice references must not execute spreadsheet formulas.
    const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
}

function exportStatus(item: ReturnType<typeof buildFinanceQueues>['drafts'][number]): string {
    if (item.invoice.status === 'draft') return 'Draft — not issued';
    switch (item.collectionStage) {
        case 'overdue':
            return item.paid > 0
                ? 'Overdue — part-paid'
                : item.start && item.end
                  ? 'Overdue — past assessment period'
                  : 'Overdue';
        case 'in_period':
            return item.paid > 0
                ? 'In period — part-paid'
                : item.start && item.end
                  ? 'In period — due'
                  : 'Due today';
        case 'upcoming':
            return item.paid > 0 ? 'Upcoming — part-paid' : 'Upcoming — issued in advance';
        case 'paid':
            return 'Paid in full';
        case 'void':
            return 'Void — not due';
        default:
            return item.paid > 0 ? 'Needs checking — part-paid' : 'Needs checking';
    }
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
            exportStatus(item),
            item.amountValid ? (item.amount/100).toFixed(2) : '',
            invoice.status !== 'draft' && item.financialReliable ? (item.remaining/100).toFixed(2) : '',
            formatInvoiceDate(invoice.dueDate),
        ]);
    }
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
