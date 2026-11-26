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
} from 'lucide-react';
import { VoucherPaymentForm } from '@/features/portal/components/VoucherPaymentForm';
import StripePayButton from '@/features/portal/components/StripePayButton';
import NotificationBell from '@/features/portal/components/NotificationBell';
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
import { normaliseServiceType } from '@/features/finance/service-type';

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
        <div className="min-h-screen bg-background text-foreground pb-12">
            <header className="bg-card border-b border-border sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/portal"
                        aria-label="Back to Parent Portal"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-foreground truncate">Billing &amp; Invoices</h1>
                        <p className="text-xs text-muted-foreground truncate">Manage your centre payments, bank transfers, and childcare vouchers</p>
                    </div>
                    <div className="flex items-center shrink-0">
                        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
                    </div>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Balance Overview */}
                <section className="bg-primary/10 border border-primary/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center shrink-0">
                            <CreditCard className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Total Outstanding Balance</h2>
                            <p className="text-3xl font-bold tabular-nums text-foreground mt-0.5">£{totalOutstanding.toFixed(2)}</p>
                        </div>
                    </div>
                    {totalOutstandingPence > 0 && (
                        <a href="#outstanding-invoices" className="bg-primary text-primary-foreground rounded-xl px-6 py-3 font-bold w-full md:w-auto text-center hover:bg-primary/90 transition-colors">
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
                        <Receipt className="w-5 h-5 text-primary" aria-hidden="true" />
                        <h2 className="text-lg font-bold text-foreground">Outstanding Invoices</h2>
                    </div>

                    {outstandingInvoices.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-dashed border-border text-center">
                            <p className="text-muted-foreground">You have no outstanding invoices.</p>
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
                                    <div key={inv.id} className="bg-card p-6 rounded-xl border border-border flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                                            <MapPin className="w-3 h-3" aria-hidden="true" /> {centreName}
                                                        </span>
                                                        <h3 className="font-bold text-foreground">Invoice #{inv.invoiceNumber}</h3>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {coveredChildrenLabel}
                                                    </p>
                                                    {assessmentPeriodLabel && (
                                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
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

                                            <dl className="grid grid-cols-2 gap-4 mt-4 bg-secondary/40 p-4 rounded-lg border border-border">
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Total Amount</dt>
                                                    <dd className="font-medium tabular-nums text-foreground">£{Number(inv.amount).toFixed(2)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Amount Due</dt>
                                                    <dd className="font-bold tabular-nums text-primary">£{remaining.toFixed(2)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Issued Date</dt>
                                                    <dd className="font-medium tabular-nums text-foreground">{formatInvoiceDate(inv.invoiceDate)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Due Date</dt>
                                                    <dd className={`tabular-nums ${isOverdue ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'font-medium text-foreground'}`}>
                                                        {formatInvoiceDate(inv.dueDate)}
                                                    </dd>
                                                </div>
                                            </dl>

                                            {state.stage === 'in_period' && state.hasValidPeriod && (
                                                <p className="mt-2.5 text-xs text-muted-foreground">
                                                    Payment requested by start of assessment period · Marked overdue only after {formatInvoiceDate(inv.billingPeriodEnd)}
                                                </p>
                                            )}

                                            {state.hasPendingPayment && state.pendingPence > 0 && (
                                                <div className={`mt-3 rounded-lg px-3.5 py-2.5 text-xs font-medium flex items-center gap-2 ${COLLECTION_STAGE_STYLES.in_period.badge}`}>
                                                    <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                    <span>
                                                        Voucher / TFC reference logged (£{(state.pendingPence / 100).toFixed(2)}) — awaiting centre verification
                                                    </span>
                                                </div>
                                            )}

                                            {remaining > 0 && hasBankDetails && (
                                                <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-3.5 text-xs space-y-1.5">
                                                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                                                        <Landmark className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                                                        <span>Pay by Bank Transfer ({centreName})</span>
                                                    </p>
                                                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                                        {inv.centre?.bankName && (
                                                            <div>
                                                                <dt className="text-muted-foreground">Bank</dt>
                                                                <dd className="font-semibold text-foreground">{inv.centre.bankName}</dd>
                                                            </div>
                                                        )}
                                                        {inv.centre?.sortCode && (
                                                            <div>
                                                                <dt className="text-muted-foreground">Sort Code</dt>
                                                                <dd className="font-mono font-semibold tabular-nums text-foreground">{inv.centre.sortCode}</dd>
                                                            </div>
                                                        )}
                                                        {inv.centre?.accountNo && (
                                                            <div>
                                                                <dt className="text-muted-foreground">Account No</dt>
                                                                <dd className="font-mono font-semibold tabular-nums text-foreground">{inv.centre.accountNo}</dd>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <dt className="text-muted-foreground">Reference</dt>
                                                            <dd className="font-mono font-bold text-primary">{inv.invoiceNumber}</dd>
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
                                                        Childcare Voucher / Tax-Free Childcare payment pending verification — avoid paying twice by card unless Replacing
                                                    </span>
                                                </div>
                                            )}
                                            {stripeEnabled && (
                                                <StripePayButton invoiceId={inv.id} amountDue={remaining} />
                                            )}
                                            {normaliseServiceType(inv.serviceType) !== 'tuition' ? (
                                                <div className={stripeEnabled ? 'border-t border-border pt-3' : ''}>
                                                    <p className="text-xs text-muted-foreground font-semibold mb-2">
                                                        {stripeEnabled ? 'Or pay by childcare voucher' : 'Pay by childcare voucher'}
                                                    </p>
                                                    <VoucherPaymentForm invoiceId={inv.id} amountDue={remaining} />
                                                </div>
                                            ) : !stripeEnabled ? (
                                                <p className="text-xs text-muted-foreground">
                                                    Please arrange payment by bank transfer using reference <span className="font-mono font-semibold text-foreground">{inv.invoiceNumber}</span>.
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
                            <Receipt className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                            <h2 className="text-lg font-bold text-foreground">Payment History</h2>
                        </div>

                        {paymentEntries.length > 0 && (
                            <div className="space-y-3">
                                {paymentEntries.map(payment => {
                                    const isVerified = payment.status === 'verified';
                                    return (
                                        <div
                                            key={payment.id}
                                            className="bg-card p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
                                        >
                                            <div className="flex flex-wrap gap-3 items-center">
                                                <span className="text-muted-foreground font-mono text-sm tabular-nums">
                                                    {formatInvoiceDate(payment.recordedAt)}
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                                    <MapPin className="w-3 h-3" aria-hidden="true" /> {payment.centreName}
                                                </span>
                                                <span className="font-medium text-foreground">
                                                    Invoice #{payment.invoiceNumber}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatPaymentMethodLabel(payment.method)}
                                                    {payment.transactionReference ? ` · Ref ${payment.transactionReference}` : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold tabular-nums text-foreground">
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
                                <h3 className="text-sm font-semibold text-muted-foreground">Settled &amp; Archived Invoices</h3>
                                {pastInvoices.map(({ inv, state }) => {
                                    const centreName = inv.centre?.name || 'Centre';
                                    const coveredChildrenLabel = resolveCoveredChildrenLabel(inv);
                                    const isVoid = inv.status === 'void' || state.stage === 'void';
                                    const paidDate = formatPaidDate(inv.payments);
                                    return (
                                        <div key={inv.id} className="bg-secondary/40 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                            <div className="flex flex-wrap gap-3 items-center">
                                                <span className="text-muted-foreground font-mono text-sm tabular-nums">
                                                    {formatInvoiceDate(inv.invoiceDate)}
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                                    <MapPin className="w-3 h-3" aria-hidden="true" /> {centreName}
                                                </span>
                                                <span className="font-medium text-foreground">
                                                    Invoice #{inv.invoiceNumber}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    ({coveredChildrenLabel})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {isVoid ? (
                                                    <span className="line-through tabular-nums text-muted-foreground">£{Number(inv.amount).toFixed(2)}</span>
                                                ) : (
                                                    <span className="font-bold tabular-nums text-foreground">£{Number(inv.amount).toFixed(2)}</span>
                                                )}
                                                {isVoid ? (
                                                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${COLLECTION_STAGE_STYLES.void.badge}`}>
                                                        <Receipt className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                        <span>Void</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                        <span>{paidDate ? `Paid in full (${paidDate})` : 'Paid in full'}</span>
                                                    </span>
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
