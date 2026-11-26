/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { getInvoiceDetails } from '@/features/finance/actions';
import InvoiceDetailsClient from '@/features/finance/components/InvoiceDetailsClient';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getInvoiceWhatsAppInfo } from '@/features/whatsapp/actions';
import { WhatsAppApiPanel } from '@/features/whatsapp/components';
import { isWhatsAppApiEnabled } from '@/features/whatsapp/config';

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

    // Additive WhatsApp Business panel: only rendered when the API flag is ON (Phase 1 wa.me buttons are unaffected).
    const waInfo = isWhatsAppApiEnabled() ? await getInvoiceWhatsAppInfo(id).catch(() => null) : null;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <InvoiceDetailsClient 
                invoice={invoice} 
                organisationName={invoice.centre?.name || org?.name || 'CENTRE'}
                userRole={userRole}
            />
            {waInfo?.success && (
                <div className="mt-6">
                    <WhatsAppApiPanel invoiceId={id} parentId={invoice.parentId} invoiceStatus={invoice.status} apiAvailable={waInfo.apiAvailable} consent={waInfo.consent} messages={waInfo.messages} />
                </div>
            )}
        </div>
    );
}
