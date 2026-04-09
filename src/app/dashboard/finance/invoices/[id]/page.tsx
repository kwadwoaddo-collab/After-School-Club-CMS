import { auth } from '@/lib/auth';
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
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    
    // Check role access - Strictly ORG_OWNER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        return redirect('/dashboard');
    }

    const { id } = params;
    
    // Fetch invoice and org details in parallel
    const [invoice, org] = await Promise.all([
        getInvoiceDetails(id),
        db.query.organisations.findFirst({
            where: eq(organisations.id, session.user.organisationId),
            columns: { name: true }
        })
    ]);

    if (!invoice) {
        return notFound();
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <InvoiceDetailsClient 
                invoice={invoice} 
                organisationName={org?.name || 'HASC CENTRE'} 
            />
        </div>
    );
}
