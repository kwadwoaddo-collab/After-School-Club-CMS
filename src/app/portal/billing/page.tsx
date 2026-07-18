import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Receipt, AlertCircle } from 'lucide-react';
import { VoucherPaymentForm } from '@/components/portal/VoucherPaymentForm';

export default async function BillingDashboard() {
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

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
                    <Link href="/portal" className="p-2 -ml-2 rounded-lg hover:bg-card transition-colors text-on-surface-variant">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-white">Billing & Invoices</h1>
                        <p className="text-xs text-on-surface-variant">Manage your payments and vouchers</p>
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
                            <h2 className="text-3xl font-bold text-white">£{totalOutstanding.toFixed(2)}</h2>
                        </div>
                    </div>
                </section>

                {/* Outstanding Invoices */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-secondary" />
                        <h2 className="text-lg font-bold text-white">Outstanding Invoices</h2>
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

                                return (
                                    <div key={inv.id} className="bg-card p-6 rounded-xl border border-outline-variant/10 flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-bold text-white">Invoice #{inv.invoiceNumber}</h3>
                                                    <p className="text-sm text-on-surface-variant">
                                                        {inv.centre?.name} {inv.child ? `• ${inv.child.firstName} ${inv.child.lastName}` : ''}
                                                    </p>
                                                </div>
                                                <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                                                    {inv.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-4 bg-secondary/40 p-4 rounded-lg">
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Total Amount</p>
                                                    <p className="font-medium text-white">£{Number(inv.amount).toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Amount Due</p>
                                                    <p className="font-bold text-secondary">£{remaining.toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Issued Date</p>
                                                    <p className="font-medium text-white">{new Date(inv.invoiceDate).toLocaleDateString('en-GB')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-on-surface-variant">Due Date</p>
                                                    <p className="font-medium text-rose-500">{new Date(inv.dueDate).toLocaleDateString('en-GB')}</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="w-full md:w-72 flex flex-col justify-center border-t md:border-t-0 md:border-l border-outline-variant/10 pt-4 md:pt-0 md:pl-6">
                                            <VoucherPaymentForm invoiceId={inv.id} amountDue={remaining} />
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
                            <h2 className="text-lg font-bold text-white opacity-80">Payment History</h2>
                        </div>
                        <div className="space-y-3 opacity-80">
                            {pastInvoices.map(inv => (
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
                                        <span className="font-bold text-white">£{Number(inv.amount).toFixed(2)}</span>
                                        <span className="text-xs px-2 py-1 bg-tertiary-container/10 text-tertiary border border-tertiary/20 rounded-full font-bold">
                                            {inv.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
