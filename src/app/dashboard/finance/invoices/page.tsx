import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { InvoiceTable } from '@/features/finance/components/FinanceDashboardClient';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default async function InvoicesListPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    
    // Check role access - Strictly ORG_OWNER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        return redirect('/dashboard');
    }

    // Fetch all invoices for the organization
    const allInvoices = await db.query.invoices.findMany({
        where: eq(invoices.organisationId, session.user.organisationId),
        orderBy: [desc(invoices.createdAt)],
        with: {
            centre: true,
            child: true
        }
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Link 
                        href="/dashboard/finance"
                        className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors font-bold group mb-2"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Ledger
                    </Link>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Full Invoice History</h1>
                    <p className="text-on-surface-variant font-medium mt-1">
                        A complete record of all billing transactions
                    </p>
                </div>
            </div>

            {/* List Card */}
            <div className="glassmorphic-card rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-6 text-primary">
                    <FileText className="w-5 h-5" />
                    <span className="text-sm font-bold uppercase tracking-widest">{allInvoices.length} total records</span>
                </div>
                
                <InvoiceTable invoices={allInvoices} />
            </div>
        </div>
    );
}
