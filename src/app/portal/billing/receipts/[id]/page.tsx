/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices, children } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { isValidUuid } from '@/lib/uuid';
import { normaliseServiceType, serviceTypeLabel } from '@/features/finance/service-type';
import { PrintReceiptButton } from './PrintReceiptButton';
import { ArrowLeft, CheckCircle2, Receipt, Building2, Calendar, CreditCard, ShieldCheck } from 'lucide-react';

function formatDate(date?: Date | string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatShortDate(date?: Date | string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatPaymentMethod(method?: string | null): string {
    if (!method) return 'Payment';
    switch (method) {
        case 'voucher': return 'Voucher / Tax-Free Childcare';
        case 'bank_transfer': return 'Bank Transfer';
        case 'stripe': return 'Card (Stripe)';
        case 'cash': return 'Cash';
        default: return method.replace(/_/g, ' ').toUpperCase();
    }
}

export default async function ParentReceiptPage(props: { params: Promise<{ id: string }> }) {
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    const { id } = await props.params;
    if (!isValidUuid(id)) notFound();

    // Strict parent isolation & paid-status verification (PR Slice W6-C / UX-03)
    const invoice = await db.query.invoices.findFirst({
        where: and(
            eq(invoices.id, id),
            eq(invoices.parentId, parent.id),
            eq(invoices.status, 'paid')
        ),
        with: {
            centre: true,
            child: true,
            payments: {
                where: (payments, { ne, and, isNull: isPayNull }) =>
                    and(ne(payments.status, 'reversed'), isPayNull(payments.reversedAt)),
                orderBy: (payments, { desc }) => [desc(payments.recordedAt)],
            },
        },
    });

    if (!invoice) notFound();

    // Enforce soft-delete guard: isNull(children.deletedAt)
    if (invoice.child && (invoice.child as any).deletedAt !== null) {
        notFound();
    }

    const serviceType = normaliseServiceType(invoice.serviceType);
    const isChildcare = serviceType !== 'tuition';
    const verifiedPayments = invoice.payments ?? [];
    const latestPayment = verifiedPayments[0] ?? null;
    const latestPaymentDate = latestPayment ? formatDate(latestPayment.recordedAt) : '—';
    const totalPaidAmount = verifiedPayments.reduce(
        (sum: number, p: any) => sum + Number(p.amount || 0),
        0
    );
    const amountPaid = totalPaidAmount > 0 ? totalPaidAmount : Number(invoice.amount || 0);
    const centre = invoice.centre;
    const child = invoice.child;

    const servicePeriodLabel =
        invoice.billingPeriodStart && invoice.billingPeriodEnd
            ? `${formatShortDate(invoice.billingPeriodStart)} – ${formatShortDate(invoice.billingPeriodEnd)}`
            : invoice.billingPeriodStart
            ? `From ${formatShortDate(invoice.billingPeriodStart)}`
            : '—';

    return (
        <div className="min-h-screen bg-page text-text pb-16 print:bg-white print:text-slate-900 print:pb-0">
            {/* Screen Header / Back Bar */}
            <header className="bg-surface border-b border-border sticky top-0 z-20 print:hidden">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/portal/billing"
                            aria-label="Back to billing"
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl hover:bg-surface-alt transition-colors text-text-muted hover:text-text cursor-pointer"
                        >
                            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                        </Link>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Payment Confirmation</p>
                            <h1 className="text-lg font-bold text-text leading-tight">Parent Payment Receipt</h1>
                        </div>
                    </div>
                    <PrintReceiptButton />
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                {/* Receipt Card Shell */}
                <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0 print:bg-white print:text-slate-900 [&_*]:print:text-slate-900 [&_*]:print:border-slate-300">
                    {/* Top Identity & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-border">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center font-bold text-sm">
                                    SS
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                                    {centre?.name || 'SprintScale After-School Club'}
                                </span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">Payment Receipt</h2>
                            <p className="text-xs sm:text-sm text-text-muted mt-1">
                                Invoice #{invoice.invoiceNumber} · Issued {formatDate(invoice.invoiceDate)}
                            </p>
                        </div>
                        <div className="sm:text-right space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--if-success-soft,#f0fdf4)] text-[var(--if-success,#166534)] border border-[var(--if-success,#166534)]/20">
                                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                <span>Paid in Full</span>
                            </div>
                            <div className="text-2xl sm:text-3xl font-extrabold text-text tabular-nums">
                                £{amountPaid.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Boxed Key Details — Gated by Service Type (PR #82 / UX-03) */}
                    <section className="rounded-2xl border-2 border-border bg-surface-alt/60 p-5 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-accent" aria-hidden="true" />
                                <span>Key Details</span>
                            </h3>
                            <span className="text-xs text-text-muted font-medium">Childcare / Tax-Free Claims Evidence</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                            <div>
                                <dt className="text-xs font-medium text-text-muted">Type of Service:</dt>
                                <dd className="text-sm font-bold text-text mt-0.5">{serviceTypeLabel(invoice.serviceType)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-text-muted">Service Period:</dt>
                                <dd className="text-sm font-bold text-text mt-0.5 tabular-nums">{servicePeriodLabel}</dd>
                                <p className="text-[11px] text-text-muted mt-0.5">Assessment period covered by this payment</p>
                            </div>
                            {/* Ofsted Registration No is displayed ONLY when serviceType !== tuition */}
                            {isChildcare && (
                                <div>
                                    <dt className="text-xs font-medium text-text-muted">Ofsted Registration No:</dt>
                                    <dd className="text-sm font-bold text-text mt-0.5 font-mono">{centre?.ofstedId || '—'}</dd>
                                </div>
                            )}
                            <div>
                                <dt className="text-xs font-medium text-text-muted">Date of Payment:</dt>
                                <dd className="text-sm font-bold text-text mt-0.5">{latestPaymentDate}</dd>
                                {verifiedPayments.length > 1 && (
                                    <p className="text-[11px] text-text-muted mt-0.5">Latest of {verifiedPayments.length} payments</p>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Customer & Centre Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                        <div className="bg-surface-alt p-5 rounded-xl border border-border space-y-1.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Customer Details</p>
                            <p className="font-bold text-text text-sm">{parent.firstName} {parent.lastName}</p>
                            <p className="text-xs text-text-muted">{parent.email}</p>
                            {parent.phone && <p className="text-xs text-text-muted tabular-nums">{parent.phone}</p>}
                            {child && (
                                <p className="text-xs font-medium text-text pt-2 border-t border-border mt-2">
                                    Student: <span className="font-bold">{child.firstName} {child.lastName}</span>
                                </p>
                            )}
                        </div>
                        <div className="bg-surface-alt p-5 rounded-xl border border-border space-y-1.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Centre Details</p>
                            <p className="font-bold text-text text-sm">{centre?.name || 'Centre'}</p>
                            {centre?.address && <p className="text-xs text-text-muted">{centre.address}</p>}
                            {centre?.billingEmail && <p className="text-xs text-text-muted">{centre.billingEmail}</p>}
                            {centre?.billingPhone && <p className="text-xs text-text-muted tabular-nums">Tel: {centre.billingPhone}</p>}
                        </div>
                    </div>

                    {/* Payments Breakdown Table */}
                    <section className="space-y-3 pt-2">
                        <h3 className="text-sm font-bold text-text uppercase tracking-wider">Payment Breakdown</h3>
                        <div className="border border-border rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-surface-alt text-xs uppercase font-semibold text-text-muted border-b border-border">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Date of Payment</th>
                                        <th scope="col" className="px-4 py-3">Payment Method</th>
                                        <th scope="col" className="px-4 py-3 text-right">Amount Paid</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y border-border">
                                    {verifiedPayments.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-surface-alt/40 transition-colors">
                                            <td className="px-4 py-3 font-medium text-text">{formatDate(p.recordedAt)}</td>
                                            <td className="px-4 py-3 text-text-muted">{formatPaymentMethod(p.method)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-text tabular-nums">£{Number(p.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {verifiedPayments.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-text">{formatDate(invoice.invoiceDate)}</td>
                                            <td className="px-4 py-3 text-text-muted">Payment on file</td>
                                            <td className="px-4 py-3 text-right font-bold text-text tabular-nums">£{amountPaid.toFixed(2)}</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-surface-alt border-t border-border font-bold">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-3 text-text">Total Received</td>
                                        <td className="px-4 py-3 text-right text-text tabular-nums text-base">£{amountPaid.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>

                    {/* Footer / Sign-off */}
                    <div className="pt-6 border-t border-border text-xs text-text-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <p>Thank you for your payment. Keep this receipt for your records and childcare reimbursement claims.</p>
                        <p className="font-mono">Ref: #{invoice.invoiceNumber}</p>
                    </div>
                </div>
            </main>
        </div>
    );
}