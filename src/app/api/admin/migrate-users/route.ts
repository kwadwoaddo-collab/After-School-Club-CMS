import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, centres, centreMemberships } from '@/db/schema';
import { eq, ne, and } from 'drizzle-orm';

/**
 * Migration API endpoint: Assign users to centres
 * 
 * This endpoint runs the migration to assign all existing non-ORG_OWNER users
 * to all centres in their organization.
 * 
 * Security:
 * - Requires authentication
 * - Only ORG_OWNER can run this
 * - Safe to run multiple times (no duplicates)
 */
export async function POST(req: Request) {
    try {
        // Check authentication
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized - Please log in' },
                { status: 401 }
            );
        }

        // Only allow ORG_OWNER to run migration
        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, session.user.id),
        });

        if (!currentUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        if (currentUser.role !== 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'Only organization owners can run migrations' },
                { status: 403 }
            );
        }

        console.log('🔄 Starting migration: Assign users to centres...');
        console.log(`👤 Requested by: ${currentUser.email} (${currentUser.role})`);

        // Get all users except ORG_OWNERs
        const allUsers = await db.query.users.findMany({
            where: ne(users.role, 'ORG_OWNER'),
        });

        console.log(`📋 Found ${allUsers.length} users to migrate (excluding ORG_OWNERs)`);

        let assignmentsCreated = 0;
        let assignmentsSkipped = 0;
        const processedUsers: string[] = [];

        for (const user of allUsers) {
            if (!user.organisationId) {
                console.log(`⚠️  Skipping user ${user.email} - no organisation`);
                continue;
            }

            // Get all centres in the user's organization
            const orgCentres = await db.query.centres.findMany({
                where: eq(centres.organisationId, user.organisationId),
            });

            console.log(`  👤 ${user.email} (${user.role}) - ${orgCentres.length} centres`);
            processedUsers.push(user.email);

            // Assign user to each centre with their current role
            for (const centre of orgCentres) {
                // Check if assignment already exists
                const existing = await db.query.centreMemberships.findFirst({
                    where: and(
                        eq(centreMemberships.userId, user.id),
                        eq(centreMemberships.centreId, centre.id)
                    ),
                });

                if (existing) {
                    console.log(`    ⏭️  Already assigned to ${centre.name}`);
                    assignmentsSkipped++;
                    continue;
                }

                // Create assignment
                await db.insert(centreMemberships).values({
                    userId: user.id,
                    centreId: centre.id,
                    role: user.role,
                });

                console.log(`    ✅ Assigned to ${centre.name}`);
                assignmentsCreated++;
            }
        }

        const result = {
            success: true,
            usersProcessed: allUsers.length,
            assignmentsCreated,
            assignmentsSkipped,
            processedUsers,
            timestamp: new Date().toISOString(),
        };

        console.log('✨ Migration complete!');
        console.log(`   Created: ${assignmentsCreated} centre assignments`);
        console.log(`   Skipped: ${assignmentsSkipped} (already existed)`);
        console.log(`   Total users migrated: ${allUsers.length}`);

        return NextResponse.json(result);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Migration failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
