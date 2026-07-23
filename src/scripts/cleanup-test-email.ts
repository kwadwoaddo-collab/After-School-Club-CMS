import { logger } from '@/lib/logger';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE importing db
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    // Dynamically import db and schema after env is loaded
    const { db } = await import('../db');
    const { users, parents, staffInvites, organisations, centres, bookings } = await import('../db/schema');
    const { eq, inArray } = await import('drizzle-orm');

    // Get email from command line arguments
    const email = process.argv[2];

    if (!email) {
        logger.error('❌ Please provide an email address.');
        logger.info('Usage: npm run db:cleanup -- <email>');
        process.exit(1);
    }

    logger.info(`🧹 Cleaning up data for email: ${email}`);

    try {
        // 1. Identify Organisations to delete
        // a. Orgs where contactEmail matches
        const orgsByEmail = await db.select().from(organisations).where(eq(organisations.contactEmail, email));

        // b. Orgs linked to the User (as owner/member)
        const usersByEmail = await db.select().from(users).where(eq(users.email, email));
        const userOrgIds = usersByEmail.map(u => u.organisationId).filter((id): id is string => !!id);

        const orgIdsToDelete = Array.from(new Set([
            ...orgsByEmail.map(o => o.id),
            ...userOrgIds
        ]));

        if (orgIdsToDelete.length > 0) {
            logger.info(`Found ${orgIdsToDelete.length} organisation(s) to cleanup.`);

            // 2. Delete Bookings linked to these Orgs (via Centres)
            // Necessary because bookings -> centres (no cascade usually) -> Org
            // If we delete bookings first, we prevent FK errors when deleting centres/orgs
            const orgCentres = await db.select().from(centres).where(inArray(centres.organisationId, orgIdsToDelete));
            const centreIds = orgCentres.map(c => c.id);

            if (centreIds.length > 0) {
                // Check if bookings exist
                const bookingsToDelete = await db.select().from(bookings).where(inArray(bookings.centreId, centreIds));
                if (bookingsToDelete.length > 0) {
                    await db.delete(bookings).where(inArray(bookings.centreId, centreIds));
                    logger.info(`  - Deleted ${bookingsToDelete.length} bookings linked to org centres.`);
                }
            }

            // 3. Delete Parents linked to these Orgs
            // Parents MUST belong to an Org. If we delete Org, we must delete Parents first (no cascade in schema)
            const parentsToDelete = await db.select().from(parents).where(inArray(parents.organisationId, orgIdsToDelete));
            if (parentsToDelete.length > 0) {
                await db.delete(parents).where(inArray(parents.organisationId, orgIdsToDelete));
                logger.info(`  - Deleted ${parentsToDelete.length} parents linked to orgs.`);
            }

            // 4. Delete the Organisations (Cascades to Centres, Users, etc.)
            await db.delete(organisations).where(inArray(organisations.id, orgIdsToDelete));
            logger.info(`  - Deleted organisations.`);
        }

        // 5. Cleanup any remaining records for this email (orphaned or unlinked)
        // Parents
        const remainingParents = await db.delete(parents).where(eq(parents.email, email)).returning({ id: parents.id });
        if (remainingParents.length > 0) logger.info(`  - Deleted ${remainingParents.length} remaining parent record(s).`);

        // Users
        const remainingUsers = await db.delete(users).where(eq(users.email, email)).returning({ id: users.id });
        if (remainingUsers.length > 0) logger.info(`  - Deleted ${remainingUsers.length} remaining user record(s).`);

        // Staff Invites
        const remainingInvites = await db.delete(staffInvites).where(eq(staffInvites.email, email)).returning({ id: staffInvites.id });
        if (remainingInvites.length > 0) logger.info(`  - Deleted ${remainingInvites.length} staff invite(s).`);



        logger.info('✨ Cleanup complete!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Error cleaning up data:', error);
        process.exit(1);
    }
}

main();
