'use server';

import { auth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { WondeService, WondeStudent } from '@/lib/services/wonde';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export async function triggerWondeSync() {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    
    await requirePermission('MANAGE_ORG');
    
    const centreIds = await getUserAccessibleCentreIds(session.user.id);
    const centreId = await resolveActiveCentreId(undefined, centreIds);
    if (!centreId || centreId === 'all') throw new Error('No active centre selected');

    const service = new WondeService(session.user.organisationId, centreId);
    
    // Use dummy data since it's stubbed in the service
    const mockStudents: WondeStudent[] = [
        {
            id: 'ws_123',
            forename: 'Alice',
            surname: 'Wonderland',
            date_of_birth: '2015-04-12',
            contact_details: [{ id: 'wc_1', forename: 'Mrs', surname: 'Wonderland', email: 'alice.mum@example.com' }]
        },
        {
            id: 'ws_124',
            forename: 'Bob',
            surname: 'Builder',
            date_of_birth: '2014-11-20',
            contact_details: [{ id: 'wc_2', forename: 'Mr', surname: 'Builder', phone: '07700900000' }]
        }
    ];

    const results = await service.syncStudents(mockStudents);

    // Update the last sync time on organisation
    await db.update(organisations)
        .set({ updatedAt: new Date() }) // Assuming we don't have a specific wondeSyncAt column
        .where(eq(organisations.id, session.user.organisationId));

    return results;
}
