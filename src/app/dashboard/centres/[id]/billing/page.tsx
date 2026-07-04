import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import CentreBillingForm from './CentreBillingForm';

export default async function CentreBillingPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;
 
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        notFound();
    }
 
    const session = await auth();
 
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    if ((session.user as any).role !== 'ORG_OWNER') return redirect('/dashboard');

    const centre = await db.query.centres.findFirst({
        where: and(
            eq(centres.id, params.id),
            eq(centres.organisationId, session.user.organisationId)
        ),
        columns: {
            id: true,
            name: true,
            bankName: true,
            sortCode: true,
            accountNo: true,
            ofstedId: true,
            managerName: true,
            billingPhone: true,
            billingEmail: true,
            address: true,
        }
    });

    if (!centre) return notFound();

    return (
        <div className="max-w-3xl mx-auto">
            <CentreBillingForm centre={centre} />
        </div>
    );
}
