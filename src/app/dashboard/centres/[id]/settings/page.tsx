import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import CentreSettingsClient from './CentreSettingsClient';

export default async function CentreSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const [{ session }, resolvedParams] = await Promise.all([
        requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] }),
        params,
    ]);

    const [accessibleIds, [centre], org] = await Promise.all([
        session.user.role === 'MANAGER'
            ? getUserAccessibleCentreIds(session.user.id)
            : Promise.resolve([]),
        db
            .select()
            .from(centres)
            .where(
                and(
                    eq(centres.id, resolvedParams.id),
                    eq(centres.organisationId, session.user.organisationId)
                )
            )
            .limit(1),
        db.query.organisations.findFirst({
            where: eq(organisations.id, session.user.organisationId),
            columns: { slug: true, name: true },
        }),
    ]);

    if (session.user.role === 'MANAGER' && !accessibleIds.includes(resolvedParams.id)) {
        return redirect('/dashboard/centres');
    }

    if (!centre) {
        return redirect('/dashboard/centres');
    }

    return <CentreSettingsClient centre={centre} orgSlug={org?.slug || ''} />;
}
