import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import CentreSettingsClient from './CentreSettingsClient';

export default async function CentreSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    // Milestone 3D: normalised from a raw auth() + manual role check to the
    // established requireAuth helper, matching the Centres List and Add
    // Centre pages. Behaviour is unchanged — this page was already
    // correctly ['ORG_OWNER','MANAGER']-only; see
    // project-notes/milestone-3d-centres-audit.md §3.
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    const resolvedParams = await params;
    
    const [centre] = await db
        .select()
        .from(centres)
        .where(
            and(
                eq(centres.id, resolvedParams.id),
                eq(centres.organisationId, session.user.organisationId)
            )
        )
        .limit(1);

    if (!centre) {
        return redirect('/dashboard/centres');
    }

    return <CentreSettingsClient centre={centre} />;
}
