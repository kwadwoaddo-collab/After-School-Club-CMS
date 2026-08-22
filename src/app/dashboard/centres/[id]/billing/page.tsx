import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
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

    // Milestone 3D: normalised from a raw auth() + manual role check to the
    // established requireAuth helper, matching the rest of the Centres
    // module. Behaviour is unchanged — this page was already correctly
    // ORG_OWNER-only, deliberately stricter than List/Settings; see
    // project-notes/milestone-3d-centres-audit.md §3.
    const { session } = await requireAuth({ roles: ['ORG_OWNER'] });

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
