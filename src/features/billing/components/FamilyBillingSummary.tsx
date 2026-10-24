import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FamilyInvoiceSummary, FamilyBillingSummary as Summary } from '@/features/billing/queries';

const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const date = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not recorded';

function invoiceLabel(invoice: FamilyInvoiceSummary) {
    return invoice.paymentStatus === 'needs_review' ? 'Needs review' : invoice.paymentStatus === 'void' ? 'Void' : invoice.paymentStatus === 'not_issued' ? 'Draft — not issued' : invoice.overdue ? 'Overdue' : invoice.paymentStatus === 'paid' ? 'Paid' : invoice.paymentStatus === 'partially_paid' ? 'Part-paid' : 'Issued — unpaid';
}

function Invoice({ invoice }: { invoice: FamilyInvoiceSummary }) {
    return <div className="space-y-1 py-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link href={`/dashboard/finance/invoices/${invoice.id}`} className="font-semibold text-primary underline underline-offset-2">{invoice.invoiceNumber}</Link>
            <span className="font-medium text-foreground">{invoiceLabel(invoice)}</span>
        </div>
        <p className="text-foreground">{date(invoice.periodStart)} – {date(invoice.periodEnd)}</p>
        {invoice.paymentStatus === 'needs_review' ? <p className="text-muted-foreground">Invoice amounts or payment records need review.</p> : <p className="text-muted-foreground tabular-nums">Billed {money(invoice.amountPence)} · Paid {money(invoice.paidPence)}{invoice.paymentStatus !== 'not_issued' && invoice.paymentStatus !== 'void' ? ` · Remaining ${money(invoice.balancePence)}` : ''}</p>}
        {invoice.status === 'draft' && invoice.historical && <p className="text-sm font-medium text-foreground">Historical billing period — review before issuing.</p>}
        <p className="text-xs text-muted-foreground">Due {date(invoice.dueDate)}{invoice.needsReview ? ' · Details need review' : ''}</p>
    </div>;
}

function FullBillingDetails({ summary }: { summary: Summary }) {
    // An upcoming issued invoice and a later draft are separate obligations.
    const upcoming = [summary.nextInvoice, ...summary.drafts].filter((i): i is FamilyInvoiceSummary => !!i).filter((i, index, all) => all.findIndex(other => other.id === i.id) === index);
    return <section aria-label="Family invoice summary" className="border-t border-border/50 px-5 py-3 space-y-3">
        <div>
            <h4 className="font-semibold text-sm text-foreground">{summary.currentPeriodState === 'not_started' ? 'First scheduled billing period' : 'Current billing period'}</h4>
            {summary.currentPeriodStart && summary.currentPeriodEnd && !summary.currentInvoices.some(invoice => invoice.periodStart === summary.currentPeriodStart && invoice.periodEnd === summary.currentPeriodEnd) && <p className="text-sm text-muted-foreground mt-1">{date(summary.currentPeriodStart)} – {date(summary.currentPeriodEnd)}</p>}
            {summary.currentPeriodState === 'not_started' && <p className="text-sm text-muted-foreground mt-1">Recurring billing has not started yet. Any prepared invoices and drafts are listed below.</p>}
            {summary.currentPeriodState === 'skipped' && <p className="text-sm text-foreground mt-1">This billing period was skipped. Its history is preserved.</p>}
            {summary.currentPeriodState === 'paused' && <p className="text-sm text-foreground mt-1">Billing is paused. Existing invoices and balances remain available.</p>}
            {summary.currentPeriodState === 'no_invoice' && <p className="text-sm text-muted-foreground mt-1">No active invoice is recorded for this period.</p>}
            {summary.currentInvoices.map(invoice => <Invoice key={invoice.id} invoice={invoice} />)}
        </div>
        {summary.previousInvoice && <details className="text-sm"><summary className="cursor-pointer font-medium text-primary py-2">Previous billed period: {date(summary.previousInvoice.periodStart)} – {date(summary.previousInvoice.periodEnd)} · {invoiceLabel(summary.previousInvoice)}</summary><Invoice invoice={summary.previousInvoice} /></details>}
        {upcoming.length > 0 && <div><h4 className="font-semibold text-sm text-foreground">Next invoice and unissued drafts</h4>{upcoming.map(invoice => <Invoice key={invoice.id} invoice={invoice} />)}</div>}
        {summary.outstandingReliable ? <p className="text-sm font-semibold text-foreground tabular-nums">Total outstanding: {money(summary.outstandingPence)} <span className="font-normal text-muted-foreground">across {summary.outstandingInvoices.length} issued invoice{summary.outstandingInvoices.length === 1 ? '' : 's'}. Drafts excluded.</span></p> : <p className="text-sm font-semibold text-foreground">Outstanding total needs review. Open the invoice history to check amounts and payments.</p>}
        {summary.outstandingInvoices.length > 0 && <details className="text-sm"><summary className="cursor-pointer font-medium text-primary py-2">All outstanding invoices ({summary.outstandingInvoices.length})</summary>{summary.outstandingInvoices.map(invoice => <Invoice key={invoice.id} invoice={invoice} />)}</details>}
        {summary.needsReview && <p className="text-sm text-foreground">Billing details need review: {summary.reviewReasons.join(' ')}</p>}
        <details className="text-sm">
            <summary className="cursor-pointer font-medium text-primary py-2">Invoice history and payment details ({summary.history.length})</summary>
            <p className="text-xs text-muted-foreground pb-1">Open an invoice to see its payment ledger, receipts and reversals. Records are preserved.</p>
            <div className="divide-y divide-border/50">{summary.history.map(invoice => <Invoice key={invoice.id} invoice={invoice} />)}</div>
            {!summary.history.length && <p className="text-muted-foreground">No invoices recorded.</p>}
        </details>
    </section>;
}


function CompactInvoice({ label, invoice }: { label: string; invoice: FamilyInvoiceSummary }) {
    const financial = invoice.paymentStatus === 'needs_review' ? 'Needs review' : invoice.paymentStatus === 'void' ? 'Void' : invoice.paymentStatus === 'not_issued' ? `${money(invoice.amountPence)} draft` : invoice.paymentStatus === 'paid' ? `${money(invoice.paidPence)} paid` : `${money(invoice.balancePence)} ${invoice.overdue ? 'overdue' : invoice.paymentStatus === 'partially_paid' ? 'remaining · part-paid' : 'unpaid'}`;
    return <div className="text-sm">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="text-muted-foreground">{label}</span><span className="font-semibold text-foreground tabular-nums">{financial}</span></p>
        <Link href={`/dashboard/finance/invoices/${invoice.id}`} className="text-primary underline underline-offset-2">{date(invoice.periodStart)} – {date(invoice.periodEnd)}</Link>
    </div>;
}

/** Keep decisions visible; supporting records expand only when requested. */
export default function FamilyBillingSummary({ summary, children, nextPeriod, preparationDate }: { summary: Summary; children?: ReactNode; nextPeriod?: string; preparationDate?: string | null }) {
    const overdue = summary.outstandingInvoices.filter(invoice => invoice.overdue);
    const current = summary.currentInvoices.filter(invoice => invoice.status !== 'void');
    return <section aria-label="Compact family billing summary" className="px-5 pb-3 space-y-3">
        {current.length === 1 ? <CompactInvoice label="Current period" invoice={current[0]} /> : current.length > 1 ? <p className="text-sm text-foreground">Current period: {current.length} invoices — open billing details.</p> : <p className="text-sm text-muted-foreground">{summary.currentPeriodState === 'not_started' ? `Billing starts ${date(summary.currentPeriodStart)}` : summary.currentPeriodState === 'skipped' ? 'Current period skipped' : summary.currentPeriodState === 'paused' ? 'Billing paused' : 'Current period: no active invoice'}</p>}
        {summary.nextInvoice && <CompactInvoice label="Next invoice" invoice={summary.nextInvoice} />}
        {!summary.nextInvoice && nextPeriod && <p className="text-sm text-muted-foreground">Next period: {nextPeriod}{preparationDate ? ` · Draft preparation ${date(preparationDate)}` : ''}</p>}
        {summary.drafts.length > 0 && <p className="text-sm text-foreground">{summary.drafts.length} draft{summary.drafts.length === 1 ? '' : 's'} awaiting review{summary.drafts.length === 1 ? ` · ${date(summary.drafts[0].periodStart)} – ${date(summary.drafts[0].periodEnd)}` : ''}</p>}
        {summary.drafts.some(invoice => invoice.historical) && <p className="text-sm font-medium text-foreground">Historical draft — review before issuing.</p>}
        {summary.outstandingReliable ? summary.outstandingPence > 0 && <p className="text-sm font-semibold text-foreground tabular-nums">Outstanding: {money(summary.outstandingPence)} <span className="font-normal text-muted-foreground">· {summary.outstandingInvoices.length} issued invoice{summary.outstandingInvoices.length === 1 ? '' : 's'}</span></p> : <p className="text-sm font-semibold text-foreground">Outstanding total needs review.</p>}
        {overdue.length > 0 && <p className="text-sm font-semibold text-foreground">{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'} — follow up payment.</p>}
        {summary.needsReview && <p className="text-sm font-medium text-foreground">Billing details need review before preparing another invoice.</p>}
        <details className="group border-t border-border/50 pt-2">
            <summary className="cursor-pointer py-1 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span className="group-open:hidden">Show billing details</span><span className="hidden group-open:inline">Hide billing details</span></summary>
            <div className="pt-2">{children}<FullBillingDetails summary={summary} /></div>
        </details>
    </section>;
}
