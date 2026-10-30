'use server';

import { requireTenantSession } from '@/lib/session';
import { requirePermission } from '@/lib/permissions';
import { WondeService, WondeStudent } from '@/lib/services/wonde';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export async function triggerWondeSync() {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    
    // Was 'MANAGE_ORG' — not a valid role literal, so requirePermission silently
    // allowed any authenticated user through (see the same fix + explanation in
    // src/features/incidents/actions.ts). 'MANAGER' also passes ORG_OWNER.
    await requirePermission('MANAGER');
    
    const centreIds = await getUserAccessibleCentreIds(session.user.id);
    const centreId = await resolveActiveCentreId(undefined, centreIds);
    if (!centreId || centreId === 'all') throw new Error('No active centre selected');

    const service = new WondeService(session.user.organisationId, centreId);
    const students = await service.fetchStudentsFromWonde();
    const results = await service.syncStudents(students);

    // Update the last sync time on organisation
    await db.update(organisations)
        .set({ updatedAt: new Date() }) // Assuming we don't have a specific wondeSyncAt column
        .where(eq(organisations.id, session.user.organisationId));

    return results;
}
