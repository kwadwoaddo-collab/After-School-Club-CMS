import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, centres, centreMemberships } from '@/db/schema';
import { eq, ne, and, inArray } from 'drizzle-orm';

/**
 * Migration API endpoint: Assign users to centres
 *
 * Runs the migration to assign all existing non-ORG_OWNER users to all centres
 * in the caller's organisation only.
 *
 * Security:
 * - Requires authentication
 * - Only ORG_OWNER can run this
 * - Scoped to the caller's org (never touches other orgs)
 * - Safe to run multiple times (skips existing memberships)
 *
 * FIX: Previously issued O(N×M) queries by querying centres + memberships per user
 * inside a loop. Now batches all reads upfront and performs a single bulk insert.
 */
export async function POST(req: Request) {
    try {
        // ── 1. Authentication + authorisation ─────────────────────────────
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized - Please log in' },
                { status: 401 }
            );
        }

        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, session.user.id),
        });

        if (!currentUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (currentUser.role !== 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'Only organization owners can run migrations' },
                { status: 403 }
            );
        }

        if (!currentUser.organisationId) {
            return NextResponse.json(
                { error: 'No organisation associated with your account' },
                { status: 400 }
            );
        }

        const orgId = currentUser.organisationId;
        console.log(`[Migration] Starting migration for org ${orgId} by ${currentUser.email}`);

        // ── 2. Fetch all relevant data in 3 queries (not N+1) ──────────────

        // 2a. All non-ORG_OWNER users in this org
        const allStaff = await db.query.users.findMany({
            where: and(eq(users.organisationId, orgId), ne(users.role, 'ORG_OWNER')),
        });

        if (allStaff.length === 0) {
            return NextResponse.json({
                success: true,
                usersProcessed: 0,
                assignmentsCreated: 0,
                assignmentsSkipped: 0,
                message: 'No staff users found to migrate',
            });
        }

        const staffIds = allStaff.map((u) => u.id);

        // 2b. All centres in this org
        const orgCentres = await db.query.centres.findMany({
            where: eq(centres.organisationId, orgId),
        });

        if (orgCentres.length === 0) {
            return NextResponse.json({
                success: true,
                usersProcessed: allStaff.length,
                assignmentsCreated: 0,
                assignmentsSkipped: 0,
                message: 'No centres found in this organisation',
            });
        }

        const centreIds = orgCentres.map((c) => c.id);

        // 2c. All existing memberships for these users (single query)
        const existingMemberships = await db
            .select({ userId: centreMemberships.userId, centreId: centreMemberships.centreId })
            .from(centreMemberships)
            .where(
                and(
                    inArray(centreMemberships.userId, staffIds),
                    inArray(centreMemberships.centreId, centreIds)
                )
            );

        // Build a Set for O(1) lookup
        const existingSet = new Set(
            existingMemberships.map((m) => `${m.userId}:${m.centreId}`)
        );

        // ── 3. Compute new memberships to insert ───────────────────────────
        const toInsert: { userId: string; centreId: string; role: string }[] = [];

        for (const user of allStaff) {
            for (const centre of orgCentres) {
                if (!existingSet.has(`${user.id}:${centre.id}`)) {
                    toInsert.push({ userId: user.id, centreId: centre.id, role: user.role });
                }
            }
        }

        // ── 4. Single bulk insert ──────────────────────────────────────────
        if (toInsert.length > 0) {
            await db.insert(centreMemberships).values(
                toInsert.map((m) => ({
                    userId: m.userId,
                    centreId: m.centreId,
                    role: m.role as any,
                }))
            );
        }

        const result = {
            success: true,
            usersProcessed: allStaff.length,
            assignmentsCreated: toInsert.length,
            assignmentsSkipped: existingMemberships.length,
            timestamp: new Date().toISOString(),
        };

        console.log(`[Migration] Complete — created ${toInsert.length} memberships, skipped ${existingMemberships.length}`);
        return NextResponse.json(result);

    } catch (error) {
        console.error('[Migration] Failed:', error);
        return NextResponse.json(
            { success: false, error: 'Migration failed' },
            { status: 500 }
        );
    }
}
