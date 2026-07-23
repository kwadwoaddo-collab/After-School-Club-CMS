import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Receipt, AlertCircle, CheckCircle2 } from 'lucide-react';
import { VoucherPaymentForm } from '@/features/portal/components/VoucherPaymentForm';
import StripePayButton from '@/features/portal/components/StripePayButton';
import NotificationBell from '@/features/portal/components/NotificationBell';
import { getNotifications } from '@/app/portal/notifications/actions';

export default async function BillingDashboard(props: { searchParams: Promise<{ payment?: string }> }) {
    const searchParams = await props.searchParams;
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    const notifications = await getNotifications();
    const unreadCount = notifications.filter(n => !n.readAt).length;

    // Check Stripe is available server-side (avoids exposing secret key to client)
    const stripeEnabled = !!(process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_xxx'));

    const parentInvoices = await db.query.invoices.findMany({
        where: eq(invoices.parentId, parent.id),
        orderBy: [desc(invoices.createdAt)],
        with: {
            centre: true,
            child: true,
            payments: true
        }
    });

    const outstandingInvoices = parentInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'void');
    const pastInvoices = parentInvoices.filter(inv => inv.status === 'paid' || inv.status === 'void');

    const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
        const paidAmount = inv.payments?.reduce((acc, p) => p.status === 'verified' ? acc + Number(p.amount) : acc, 0) || 0;
        return sum + (Number(inv.amount) - paidAmount);
    }, 0);

    return (
        <div className="min-h-screen bg-surface text-on-surface pb-12">
            <header className="bg-card border-b border-outline-variant/10 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/portal" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-card transition-colors text-on-surface-variant">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-foreground">Billing & Invoices</h1>
                        <p className="text-xs text-on-surface-variant">Manage your payments and vouchers</p>
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
                    <div className="flex items-center gap-3 bg-success/10 border border-success/20 p-4 rounded-xl">
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        <p className="text-sm font-bold text-success">Payment received — your invoice has been marked as paid.</p>
                    </div>
                )}
                {searchParams.payment === 'cancelled' && (
                    <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 p-4 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
                        <p className="text-sm font-bold text-warning">Payment was cancelled. Your invoice is still outstanding.</p>
                    </div>
                )}

                {/* Outstanding Invoices */}
                <section id="outstanding-invoices">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-secondary" />
                        <h2 className="text-lg font-bold text-foreground">Outstanding Invoices</h2>
                    </div>

                    {outstandingInvoices.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-dashed border-outline-variant/20 text-center">
                            <p className="text-on-surface-variant">You have no outstanding invoices.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {outstandingInvoices.map(inv => {
                                const paidAmount = inv.payments?.reduce((acc, p) => p.status === 'verified' ? acc + Number(p.amount) : acc, 0) || 0;
                                const remaining = Number(inv.amount) - paidAmount;
                                const isOverdue = new Date(inv.dueDate) < new Date() && remaining > 0;
                                const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', partially_paid: 'Partial', paid: 'Paid', void: 'Void' };

                                return (
                                    <div key={inv.id} className="bg-card p-6 rounded-xl border border-outline-variant/10 flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-bold text-foreground">Invoice #{inv.invoiceNumber}</h3>
                                                    <p className="text-sm text-on-surface-variant">
                                                        {inv.centre?.name} {inv.child ? `• ${inv.child.firstName} ${inv.child.lastName}` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    {isOverdue && (
                                                        <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                                            Overdue
                                                        </span>
                                                    )}
                                                    <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                                                        {STATUS_LABELS[inv.status] || inv.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-4 bg-secondary/40 p-4 rounded-lg">
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Total Amount</p>
                                                    <p className="font-medium text-foreground">£{Number(inv.amount).toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Amount Due</p>
                                                    <p className="font-bold text-secondary">£{remaining.toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Issued Date</p>
                                                    <p className="font-medium text-foreground">{new Date(inv.invoiceDate).toLocaleDateString('en-GB')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Due Date</p>
                                                    <p className={`font-medium ${isOverdue ? 'text-destructive font-bold' : 'text-foreground'}`}>{new Date(inv.dueDate).toLocaleDateString('en-GB')}</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="w-full md:w-72 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-outline-variant/10 pt-4 md:pt-0 md:pl-6">
                                            {stripeEnabled && (
                                                <StripePayButton invoiceId={inv.id} amountDue={remaining} />
                                            )}
                                            <div className={stripeEnabled ? 'border-t border-outline-variant/10 pt-3' : ''}>
                                                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">
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

                {/* Past Invoices */}
                {pastInvoices.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Receipt className="w-5 h-5 text-on-surface-variant" />
                            <h2 className="text-lg font-bold text-foreground opacity-80">Payment History</h2>
                        </div>
                        <div className="space-y-3 opacity-80">
                            {pastInvoices.map(inv => {
                                const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', partially_paid: 'Partial', paid: 'Paid', void: 'Void' };
                                return (
                                <div key={inv.id} className="bg-secondary/40 p-4 rounded-xl border border-outline-variant/5 flex justify-between items-center">
                                    <div className="flex gap-4 items-center">
                                        <span className="text-on-surface-variant font-mono text-sm">
                                            {new Date(inv.invoiceDate).toLocaleDateString('en-GB')}
                                        </span>
                                        <span className="font-medium text-on-surface-variant">
                                            Invoice #{inv.invoiceNumber}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {inv.status === 'void' ? (
                                            <span className="line-through text-on-surface-variant">£{Number(inv.amount).toFixed(2)}</span>
                                        ) : (
                                            <span className="font-bold text-foreground">£{Number(inv.amount).toFixed(2)}</span>
                                        )}
                                        <span className="text-xs px-2 py-1 bg-tertiary-container/10 text-tertiary border border-tertiary/20 rounded-full font-bold">
                                            {STATUS_LABELS[inv.status] || inv.status}
                                        </span>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
