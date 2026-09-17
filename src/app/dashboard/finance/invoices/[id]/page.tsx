/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { getInvoiceDetails } from '@/features/finance/actions';
import InvoiceDetailsClient from '@/features/finance/components/InvoiceDetailsClient';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface InvoicePageProps {
    params: {
        id: string;
    };
}

export default async function InvoicePage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await requireTenantSession();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    
    // Check role access - ORG_OWNER or MANAGER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return redirect('/dashboard');
    }

    const { id } = params;
    
    // Fetch invoice and org details in parallel
    let invoice = null;
    let org = null;
    try {
        [invoice, org] = await Promise.all([
            getInvoiceDetails(id),
            db.query.organisations.findFirst({
                where: eq(organisations.id, session.user.organisationId),
                columns: { name: true }
            })
        ]);
    } catch {
        return notFound();
    }

    if (!invoice) {
        return notFound();
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <InvoiceDetailsClient 
                invoice={invoice} 
                organisationName={org?.name || 'CENTRE'}
                userRole={userRole}
            />
        </div>
    );
}
