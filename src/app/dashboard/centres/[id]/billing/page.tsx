import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
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

    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    const userRole = (session.user as { role?: string })?.role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(params.id)) {
            notFound();
        }
    }

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
