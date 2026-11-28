/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc, and, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    CreditCard,
    Receipt,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    CalendarClock,
    MapPin,
    Landmark,
    Calendar,
    Lightbulb,
} from 'lucide-react';
import { VoucherPaymentForm } from '@/features/portal/components/VoucherPaymentForm';
import StripePayButton from '@/features/portal/components/StripePayButton';
import NotificationBell from '@/features/portal/components/NotificationBell';
import { CopyButton } from '@/components/whatsapp/WhatsAppCopyActions';
import { getNotifications } from '@/app/portal/notifications/actions';
import {
    COLLECTION_STAGE_STYLES,
    evaluateInvoiceCollectionState,
    toLondonBusinessDate,
    type InvoiceCollectionStage,
} from '@/features/finance/domain/invoice-collection-state';
import {
    formatInvoiceDate,
    formatInvoicePeriod,
    formatPaidDate,
} from '@/features/finance/domain/invoice-display';
import { normaliseServiceType, serviceTypeLabel } from '@/features/finance/service-type';

function resolveCoveredChildrenLabel(inv: any): string {
    if (Array.isArray(inv.coveredChildrenJson) && inv.coveredChildrenJson.length > 0) {
        const names = inv.coveredChildrenJson
            .map((c: any) => c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim())
            .filter(Boolean);
        if (names.length > 0) return names.join(', ');
    }
    if (inv.child) {
        return `${inv.child.firstName} ${inv.child.lastName}`;
    }
    return inv.childDisplayName || 'Family Invoice';
}

function renderCollectionStageIcon(stage: InvoiceCollectionStage) {
    switch (stage) {
        case 'overdue':
            return <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
        case 'in_period':
        case 'needs_checking':
            return <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
        case 'upcoming':
            return <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
        case 'paid':
            return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
        case 'draft':
        case 'void':
            return <Receipt className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    }
}

function formatPaymentMethodLabel(method?: string | null): string {
    if (!method) return 'Payment';
    switch (method) {
        case 'voucher':
            return 'Voucher / TFC';
        case 'bank_transfer':
            return 'Bank Transfer';
        case 'stripe':
            return 'Card';
        case 'cash':
            return 'Cash';
        default:
            return method.replace(/_/g, ' ');
    }
}

export default async function BillingDashboard(props: { searchParams: Promise<{ payment?: string }> }) {
    const searchParams = await props.searchParams;
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    // Check Stripe is available server-side (avoids exposing secret key to client)
    const stripeEnabled = !!(process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_xxx'));

    // Run independent billing queries concurrently (FE P2-1)
    const [notifications, parentInvoices] = await Promise.all([
        getNotifications(),
        db.query.invoices.findMany({
            where: and(eq(invoices.parentId, parent.id), ne(invoices.status, 'draft')),
            orderBy: [desc(invoices.createdAt)],
            with: {
                centre: true,
                child: true,
                payments: {
                    where: (payments, { ne, and, isNull }) =>
                        and(ne(payments.status, 'reversed'), isNull(payments.reversedAt)),
                }
            }
        }),
    ]);
    const unreadCount = notifications.filter(n => !n.readAt).length;

    const todayLondonIso = toLondonBusinessDate();
    const evaluatedInvoices = parentInvoices.map(inv => ({
        inv,
        state: evaluateInvoiceCollectionState(inv, todayLondonIso),
    }));

    const outstandingInvoices = evaluatedInvoices.filter(
        ({ inv, state }) => inv.status !== 'paid' && inv.status !== 'void' && state.stage !== 'paid'
    );
    const pastInvoices = evaluatedInvoices.filter(
        ({ inv, state }) => inv.status === 'paid' || inv.status === 'void' || state.stage === 'paid'
    );

    const totalOutstandingPence = outstandingInvoices.reduce(
        (sum, { state }) => sum + state.remainingPence,
        0
    );
    const totalOutstanding = totalOutstandingPence / 100;

    const paymentEntries = parentInvoices
        .flatMap(inv =>
            (inv.payments ?? [])
                .filter(p => (p.status === 'verified' || p.status === 'pending') && !p.reversedAt)
                .map(p => ({
                    ...p,
                    invoiceNumber: inv.invoiceNumber,
                    centreName: inv.centre?.name || 'Centre',
                    coveredChildrenLabel: resolveCoveredChildrenLabel(inv),
                }))
        )
        .sort((a, b) => {
            const aMs = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
            const bMs = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
            return bMs - aMs;
        });

    return (
        <div className="min-h-screen bg-page text-text pb-12">
            <header className="bg-surface border-b border-border sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/portal"
                        aria-label="Back to Parent Portal"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-surface-alt transition-colors text-text-muted hover:text-text cursor-pointer"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-text truncate">Billing &amp; Invoices</h1>
                        <p className="text-xs text-text-muted truncate">Manage your centre payments, bank transfers, and childcare vouchers</p>
                    </div>
                    <div className="flex items-center shrink-0">
                        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
                    </div>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Balance Overview */}
                <section className="bg-accent-soft border border-accent/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-accent/20 text-accent rounded-xl flex items-center justify-center shrink-0">
                            <CreditCard className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-text">Total Outstanding Balance</h2>
                            <p className="text-3xl font-bold tabular-nums text-text mt-0.5">£{totalOutstanding.toFixed(2)}</p>
                        </div>
                    </div>
                    {totalOutstandingPence > 0 && (
                        <a href="#outstanding-invoices" className="bg-accent text-on-accent rounded-xl px-6 py-3 min-h-[44px] inline-flex items-center justify-center font-bold w-full md:w-auto text-center hover:opacity-90 transition-opacity shadow-sm cursor-pointer">
                            Review Outstanding Invoices
                        </a>
                    )}
                </section>

                {/* Payment success/cancel banner */}
                {searchParams.payment === 'success' && (
                    <div className={`flex items-center gap-3 p-4 rounded-xl ${COLLECTION_STAGE_STYLES.paid.badge}`}>
                        <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <p className="text-sm font-semibold">Payment received — your invoice has been marked as paid.</p>
                    </div>
                )}
                {searchParams.payment === 'cancelled' && (
                    <div className={`flex items-center gap-3 p-4 rounded-xl ${COLLECTION_STAGE_STYLES.in_period.badge}`}>
                        <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <p className="text-sm font-semibold">Payment was cancelled. Your invoice remains open.</p>
                    </div>
                )}

                {/* Outstanding Invoices */}
                <section id="outstanding-invoices">
                    <div className="flex items-center gap-2 mb-4">
                        <Receipt className="w-5 h-5 text-accent" aria-hidden="true" />
                        <h2 className="text-lg font-bold text-text">Outstanding Invoices</h2>
                    </div>

                    {outstandingInvoices.length === 0 ? (
                        <div className="bg-surface p-8 rounded-xl border border-dashed border-border text-center">
                            <p className="text-text-muted">You have no outstanding invoices.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {outstandingInvoices.map(({ inv, state }) => {
                                const remaining = state.remainingPence / 100;
                                const isOverdue = state.stage === 'overdue';
                                const coveredChildrenLabel = resolveCoveredChildrenLabel(inv);
                                const centreName = inv.centre?.name || 'Centre';
                                const hasBillingPeriod = Boolean(inv.billingPeriodStart && inv.billingPeriodEnd);
                                const assessmentPeriodLabel = hasBillingPeriod
                                    ? formatInvoicePeriod(inv.billingPeriodStart, inv.billingPeriodEnd)
                                    : inv.billingPeriodLabel;
                                const hasBankDetails = Boolean(inv.centre?.bankName || inv.centre?.sortCode || inv.centre?.accountNo);
                                const hasNonReversedPendingPayment =
                                    state.hasPendingPayment ||
                                    (inv.payments ?? []).some((p: any) => p.status === 'pending' && !p.reversedAt);

                                return (
                                    <div key={inv.id} className="bg-surface p-6 rounded-xl border border-border flex flex-col md:flex-row gap-6 shadow-sm">
                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                                                            <MapPin className="w-3 h-3" aria-hidden="true" /> {centreName}
                                                        </span>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-alt text-text-muted border border-border">
                                                            {serviceTypeLabel(inv.serviceType)}
                                                        </span>
                                                        <h3 className="font-bold text-text">Invoice #{inv.invoiceNumber}</h3>
                                                    </div>
                                                    <p className="text-sm text-text-muted">
                                                        {coveredChildrenLabel}
                                                    </p>
                                                    {assessmentPeriodLabel && (
                                                        <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5 tabular-nums">
                                                            <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                            <span>Assessment period: {assessmentPeriodLabel}</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${COLLECTION_STAGE_STYLES[state.stage].badge}`}
                                                    >
                                                        {renderCollectionStageIcon(state.stage)}
                                                        <span>{state.parentLabel}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            <dl className="grid grid-cols-2 gap-4 mt-4 bg-surface-alt p-4 rounded-lg border border-border">
                                                <div>
                                                    <dt className="text-xs text-text-muted">Total Amount</dt>
                                                    <dd className="font-medium tabular-nums text-text">£{Number(inv.amount).toFixed(2)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-text-muted">Amount Due</dt>
                                                    <dd className="font-bold tabular-nums text-accent">£{remaining.toFixed(2)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-text-muted">Issued Date</dt>
                                                    <dd className="font-medium tabular-nums text-text">{formatInvoiceDate(inv.invoiceDate)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-text-muted">Due Date</dt>
                                                    <dd className={`tabular-nums ${isOverdue ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'font-medium text-text'}`}>
                                                        {formatInvoiceDate(inv.dueDate)}
                                                    </dd>
                                                </div>
                                            </dl>

                                            {state.stage === 'in_period' && state.hasValidPeriod && (
                                                <p className="mt-2.5 text-xs text-text-muted tabular-nums">
                                                    Payment requested by start of assessment period · Marked overdue only after {formatInvoiceDate(inv.billingPeriodEnd)}
                                                </p>
                                            )}

                                            {state.hasPendingPayment && state.pendingPence > 0 && (
                                                <div className={`mt-3 rounded-lg px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 ${COLLECTION_STAGE_STYLES.in_period.badge}`}>
                                                    <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                    <span className="tabular-nums">
                                                        Voucher / TFC reference logged (£{(state.pendingPence / 100).toFixed(2)}) — awaiting centre verification
                                                    </span>
                                                </div>
                                            )}

                                            {remaining > 0 && hasBankDetails && (
                                                <div className="mt-4 bg-accent-soft border border-accent/20 rounded-lg p-3.5 text-xs space-y-1.5">
                                                    <p className="font-semibold text-text flex items-center gap-1.5">
                                                        <Landmark className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                                                        <span>Pay by Bank Transfer ({centreName})</span>
                                                    </p>
                                                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                                        {inv.centre?.bankName && (
                                                            <div>
                                                                <dt className="text-text-muted">Bank</dt>
                                                                <dd className="font-semibold text-text">{inv.centre.bankName}</dd>
                                                            </div>
                                                        )}
                                                        {inv.centre?.sortCode && (
                                                            <div>
                                                                <dt className="text-text-muted">Sort Code</dt>
                                                                <dd className="font-mono font-semibold tabular-nums text-text flex items-center gap-1">
                                                                    <span>{inv.centre.sortCode}</span>
                                                                    <CopyButton kind="number" variant="icon" text={inv.centre.sortCode} recipientName="Sort Code" />
                                                                </dd>
                                                            </div>
                                                        )}
                                                        {inv.centre?.accountNo && (
                                                            <div>
                                                                <dt className="text-text-muted">Account No</dt>
                                                                <dd className="font-mono font-semibold tabular-nums text-text flex items-center gap-1">
                                                                    <span>{inv.centre.accountNo}</span>
                                                                    <CopyButton kind="number" variant="icon" text={inv.centre.accountNo} recipientName="Account Number" />
                                                                </dd>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <dt className="text-text-muted">Reference</dt>
                                                            <dd className="font-mono font-bold text-accent flex items-center gap-1">
                                                                <span>{inv.invoiceNumber}</span>
                                                                <CopyButton kind="number" variant="icon" text={inv.invoiceNumber} recipientName="Invoice Reference" />
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-full md:w-72 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                                            {hasNonReversedPendingPayment && (
                                                <div
                                                    role="status"
                                                    className={`rounded-lg px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${COLLECTION_STAGE_STYLES.in_period.badge}`}
                                                >
                                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                                    <span>
                                                        Childcare Voucher / Tax-Free Childcare payment pending verification — avoid paying twice by card unless replacing
                                                    </span>
                                                </div>
                                            )}
                                            {stripeEnabled && (
                                                <StripePayButton invoiceId={inv.id} amountDue={remaining} />
                                            )}
                                            {normaliseServiceType(inv.serviceType) !== 'tuition' ? (
                                                <div className={stripeEnabled ? 'border-t border-border pt-3' : ''}>
                                                    <p className="text-xs text-text-muted font-semibold mb-2">
                                                        {stripeEnabled ? 'Or pay by childcare voucher' : 'Pay by childcare voucher'}
                                                    </p>
                                                    <VoucherPaymentForm invoiceId={inv.id} amountDue={remaining} />

                                                    {/* Collapsible Tax-Free Childcare & Voucher Advice (UX-04) */}
                                                    <details className="mt-3 bg-surface-alt/70 border border-border rounded-xl p-3 text-xs text-text-muted group">
                                                        <summary className="font-semibold text-text cursor-pointer select-none flex items-center justify-between list-none">
                                                            <span className="flex items-center gap-1.5">
                                                                <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                                                                <span>Paying by Tax-Free Childcare?</span>
                                                            </span>
                                                            <span className="text-text-muted group-open:rotate-180 transition-transform font-mono text-[10px]">▼</span>
                                                        </summary>
                                                        <div className="mt-2 pt-2 border-t border-border space-y-1.5 leading-relaxed">
                                                            <p>
                                                                Send payment via your Government Tax-Free Childcare or voucher account using invoice ref <strong className="font-mono text-text">{inv.invoiceNumber}</strong>.
                                                            </p>
                                                            <p>
                                                                Then enter your remittance reference above. Centre staff manually reconcile vouchers within 2 business days.
                                                            </p>
                                                        </div>
                                                    </details>
                                                </div>
                                            ) : !stripeEnabled ? (
                                                <p className="text-xs text-text-muted">
                                                    Please arrange payment by bank transfer using reference <span className="font-mono font-semibold text-text">{inv.invoiceNumber}</span>.
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Payment History & Settled Invoices */}
                {(paymentEntries.length > 0 || pastInvoices.length > 0) && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-text-muted" aria-hidden="true" />
                            <h2 className="text-lg font-bold text-text">Payment History</h2>
                        </div>

                        {paymentEntries.length > 0 && (
                            <div className="space-y-3">
                                {paymentEntries.map(payment => {
                                    const isVerified = payment.status === 'verified';
                                    return (
                                        <div
                                            key={payment.id}
                                            className="bg-surface p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
                                        >
                                            <div className="flex flex-wrap gap-3 items-center">
                                                <span className="text-text-muted font-mono text-sm tabular-nums">
                                                    {formatInvoiceDate(payment.recordedAt)}
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                                                    <MapPin className="w-3 h-3" aria-hidden="true" /> {payment.centreName}
                                                </span>
                                                <span className="font-medium text-text">
                                                    Invoice #{payment.invoiceNumber}
                                                </span>
                                                <span className="text-xs text-text-muted">
                                                    {formatPaymentMethodLabel(payment.method)}
                                                    {payment.transactionReference ? ` · Ref ${payment.transactionReference}` : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold tabular-nums text-text">
                                                    £{Number(payment.amount).toFixed(2)}
                                                </span>
                                                {isVerified ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                        <span>Verified</span>
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${COLLECTION_STAGE_STYLES.in_period.badge}`}>
                                                        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                        <span>Awaiting verification</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {pastInvoices.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-text-muted">Settled &amp; Archived Invoices</h3>
                                {pastInvoices.map(({ inv, state }) => {
                                    const centreName = inv.centre?.name || 'Centre';
                                    const coveredChildrenLabel = resolveCoveredChildrenLabel(inv);
                                    const isVoid = inv.status === 'void' || state.stage === 'void';
                                    const paidDate = formatPaidDate(inv.payments);
                                    return (
                                        <div key={inv.id} className="bg-surface-alt p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                            <div className="flex flex-wrap gap-3 items-center">
                                                <span className="text-text-muted font-mono text-sm tabular-nums">
                                                    {formatInvoiceDate(inv.invoiceDate)}
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                                                    <MapPin className="w-3 h-3" aria-hidden="true" /> {centreName}
                                                </span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface text-text-muted border border-border">
                                                    {serviceTypeLabel(inv.serviceType)}
                                                </span>
                                                <span className="font-medium text-text">
                                                    Invoice #{inv.invoiceNumber}
                                                </span>
                                                <span className="text-xs text-text-muted">
                                                    ({coveredChildrenLabel})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                                                {isVoid ? (
                                                    <span className="line-through tabular-nums text-text-muted">£{Number(inv.amount).toFixed(2)}</span>
                                                ) : (
                                                    <span className="font-bold tabular-nums text-text">£{Number(inv.amount).toFixed(2)}</span>
                                                )}
                                                {isVoid ? (
                                                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${COLLECTION_STAGE_STYLES.void.badge}`}>
                                                        <Receipt className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                        <span>Void</span>
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                            <span>{paidDate ? `Paid in full (${paidDate})` : 'Paid in full'}</span>
                                                        </span>
                                                        <Link
                                                            href={`/portal/billing/receipts/${inv.id}`}
                                                            aria-label={`View receipt for invoice #${inv.invoiceNumber}`}
                                                            className="inline-flex items-center gap-1 min-h-[44px] px-3 py-1.5 text-xs font-bold text-accent hover:underline rounded-lg hover:bg-accent-soft transition-colors cursor-pointer"
                                                        >
                                                            <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
                                                            <span>View Receipt</span>
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}