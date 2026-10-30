/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc, and, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Receipt, AlertCircle, CheckCircle2, MapPin, Landmark, Calendar } from 'lucide-react';
import { VoucherPaymentForm } from '@/features/portal/components/VoucherPaymentForm';
import StripePayButton from '@/features/portal/components/StripePayButton';
import NotificationBell from '@/features/portal/components/NotificationBell';
import { getNotifications } from '@/app/portal/notifications/actions';

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

export default async function BillingDashboard(props: { searchParams: Promise<{ payment?: string }> }) {
    const searchParams = await props.searchParams;
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    const notifications = await getNotifications();
    const unreadCount = notifications.filter(n => !n.readAt).length;

    // Check Stripe is available server-side (avoids exposing secret key to client)
    const stripeEnabled = !!(process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_xxx'));

    const parentInvoices = await db.query.invoices.findMany({
        where: and(eq(invoices.parentId, parent.id), ne(invoices.status, 'draft')),
        orderBy: [desc(invoices.createdAt)],
        with: {
            centre: true,
            child: true,
            payments: {
                where: (payments, { ne }) => ne(payments.status, 'reversed')
            }
        }
    });

    const outstandingInvoices = parentInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'void');
    const pastInvoices = parentInvoices.filter(inv => inv.status === 'paid' || inv.status === 'void');

    const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
        const paidAmount = inv.payments?.reduce((acc, p) => p.status === 'verified' ? acc + Number(p.amount) : acc, 0) || 0;
        return sum + (Number(inv.amount) - paidAmount);
    }, 0);

    return (
        <div className="min-h-screen bg-background text-foreground pb-12">
            <header className="bg-card border-b border-border sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/portal" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-foreground">Billing & Invoices</h1>
                        <p className="text-xs text-muted-foreground">Manage your centre payments, bank transfers, and childcare vouchers</p>
                    </div>
                    <div className="flex items-center">
                        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Balance Overview */}
                <section className="bg-primary/10 border border-primary/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-primary font-medium">Total Outstanding Balance</p>
                            <h2 className="text-3xl font-bold text-foreground">£{totalOutstanding.toFixed(2)}</h2>
                        </div>
                    </div>
                    {totalOutstanding > 0 && (
                        <a href="#outstanding-invoices" className="bg-primary text-primary-foreground rounded-xl px-6 py-3 font-bold w-full md:w-auto text-center hover:bg-primary/90 transition-colors">
                            Pay All Outstanding →
                        </a>
                    )}
                </section>

                {/* Payment success/cancel banner */}
                {searchParams.payment === 'success' && (
                    <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <p className="text-sm font-bold text-emerald-600">Payment received — your invoice has been marked as paid.</p>
                    </div>
                )}
                {searchParams.payment === 'cancelled' && (
                    <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <p className="text-sm font-bold text-amber-600">Payment was cancelled. Your invoice is still outstanding.</p>
                    </div>
                )}

                {/* Outstanding Invoices */}
                <section id="outstanding-invoices">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-secondary" />
                        <h2 className="text-lg font-bold text-foreground">Outstanding Invoices</h2>
                    </div>

                    {outstandingInvoices.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-dashed border-border text-center">
                            <p className="text-muted-foreground">You have no outstanding invoices.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {outstandingInvoices.map(inv => {
                                const paidAmount = inv.payments?.reduce((acc, p) => p.status === 'verified' ? acc + Number(p.amount) : acc, 0) || 0;
                                const remaining = Number(inv.amount) - paidAmount;
                                const isOverdue = new Date(inv.dueDate) < new Date() && remaining > 0;
                                const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', partially_paid: 'Partial', paid: 'Paid', void: 'Void' };
                                const coveredChildrenLabel = resolveCoveredChildrenLabel(inv);
                                const centreName = inv.centre?.name || 'Centre';
                                const hasBillingPeriod = Boolean(inv.billingPeriodStart && inv.billingPeriodEnd);
                                const hasBankDetails = Boolean(inv.centre?.bankName || inv.centre?.sortCode || inv.centre?.accountNo);

                                return (
                                    <div key={inv.id} className="bg-card p-6 rounded-xl border border-border flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2 gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                                            <MapPin className="w-3 h-3" /> {centreName}
                                                        </span>
                                                        <h3 className="font-bold text-foreground">Invoice #{inv.invoiceNumber}</h3>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {coveredChildrenLabel}
                                                    </p>
                                                    {(hasBillingPeriod || inv.billingPeriodLabel) && (
                                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {hasBillingPeriod
                                                                ? `${new Date(inv.billingPeriodStart!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(inv.billingPeriodEnd!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                                                : inv.billingPeriodLabel}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    {isOverdue && (
                                                        <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                                            Overdue
                                                        </span>
                                                    )}
                                                    <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                        {STATUS_LABELS[inv.status] || inv.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-4 bg-secondary/40 p-4 rounded-lg border border-border">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Total Amount</p>
                                                    <p className="font-medium text-foreground">£{Number(inv.amount).toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Amount Due</p>
                                                    <p className="font-bold text-primary">£{remaining.toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Issued Date</p>
                                                    <p className="font-medium text-foreground">{new Date(inv.invoiceDate).toLocaleDateString('en-GB')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Due Date</p>
                                                    <p className={`font-medium ${isOverdue ? 'text-destructive font-bold' : 'text-foreground'}`}>{new Date(inv.dueDate).toLocaleDateString('en-GB')}</p>
                                                </div>
                                            </div>

                                            {remaining > 0 && hasBankDetails && (
                                                <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-3.5 text-xs space-y-1.5">
                                                    <p className="font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                                                        <Landmark className="w-3.5 h-3.5 text-primary" />
                                                        Pay by Bank Transfer ({centreName})
                                                    </p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                                        {inv.centre?.bankName && (
                                                            <div>
                                                                <span className="text-muted-foreground block">Bank</span>
                                                                <span className="font-semibold text-foreground">{inv.centre.bankName}</span>
                                                            </div>
                                                        )}
                                                        {inv.centre?.sortCode && (
                                                            <div>
                                                                <span className="text-muted-foreground block">Sort Code</span>
                                                                <span className="font-mono font-semibold text-foreground">{inv.centre.sortCode}</span>
                                                            </div>
                                                        )}
                                                        {inv.centre?.accountNo && (
                                                            <div>
                                                                <span className="text-muted-foreground block">Account No</span>
                                                                <span className="font-mono font-semibold text-foreground">{inv.centre.accountNo}</span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <span className="text-muted-foreground block">Reference</span>
                                                            <span className="font-mono font-bold text-primary">{inv.invoiceNumber}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="w-full md:w-72 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                                            {stripeEnabled && (
                                                <StripePayButton invoiceId={inv.id} amountDue={remaining} />
                                            )}
                                            <div className={stripeEnabled ? 'border-t border-border pt-3' : ''}>
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                                                    {stripeEnabled ? 'Or pay by childcare voucher' : 'Pay by childcare voucher'}
                                                </p>
                                                <VoucherPaymentForm invoiceId={inv.id} amountDue={remaining} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Past Invoices / Payment History */}
                {pastInvoices.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Receipt className="w-5 h-5 text-muted-foreground" />
                            <h2 className="text-lg font-bold text-foreground opacity-80">Payment History</h2>
                        </div>
                        <div className="space-y-3 opacity-90">
                            {pastInvoices.map(inv => {
                                const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', partially_paid: 'Partial', paid: 'Paid', void: 'Void' };
                                const centreName = inv.centre?.name || 'Centre';
                                const coveredChildrenLabel = resolveCoveredChildrenLabel(inv);
                                return (
                                    <div key={inv.id} className="bg-secondary/40 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                        <div className="flex flex-wrap gap-3 items-center">
                                            <span className="text-muted-foreground font-mono text-sm">
                                                {new Date(inv.invoiceDate).toLocaleDateString('en-GB')}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                                <MapPin className="w-3 h-3" /> {centreName}
                                            </span>
                                            <span className="font-medium text-foreground">
                                                Invoice #{inv.invoiceNumber}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                ({coveredChildrenLabel})
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {inv.status === 'void' ? (
                                                <span className="line-through text-muted-foreground">£{Number(inv.amount).toFixed(2)}</span>
                                            ) : (
                                                <span className="font-bold text-foreground">£{Number(inv.amount).toFixed(2)}</span>
                                            )}
                                            <span className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full font-bold">
                                                {STATUS_LABELS[inv.status] || inv.status}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
