/**
 * Migration: Assign existing users to all centres
 * 
 * This migration assigns all existing non-ORG_OWNER users to all centres
 * in their organization. This ensures no disruption during the transition
 * to centre-based access control.
 * 
 * ORG_OWNER users are NOT assigned because they have implicit access to all centres.
 * 
 * Run this ONCE after deploying the permissions system.
 */

import { db } from '@/db';
import { users, centres, centreMemberships } from '@/db/schema';
import { eq, ne } from 'drizzle-orm';

export async function migrateExistingUsersToCentres() {
    console.log('🔄 Starting migration: Assign users to centres...');

    // Get all users except ORG_OWNERs
    const allUsers = await db.query.users.findMany({
        where: ne(users.role, 'ORG_OWNER'),
    });

    console.log(`📋 Found ${allUsers.length} users to migrate (excluding ORG_OWNERs)`);

    let assignmentsCreated = 0;
    let assignmentsSkipped = 0;

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

        // Assign user to each centre with their current role
        for (const centre of orgCentres) {
            // Check if assignment already exists
            const existing = await db.query.centreMemberships.findFirst({
                where: (memberships, { and, eq }) =>
                    and(
                        eq(memberships.userId, user.id),
                        eq(memberships.centreId, centre.id)
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

    console.log('\n✨ Migration complete!');
    console.log(`   Created: ${assignmentsCreated} centre assignments`);
    console.log(`   Skipped: ${assignmentsSkipped} (already existed)`);
    console.log(`   Total users migrated: ${allUsers.length}`);

    return {
        usersProcessed: allUsers.length,
        assignmentsCreated,
        assignmentsSkipped,
    };
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateExistingUsersToCentres()
        .then((result) => {
            console.log('\n📊 Migration Results:', result);
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}
