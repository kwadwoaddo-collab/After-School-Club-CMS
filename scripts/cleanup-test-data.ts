import { db } from '@/db';
import { users, organisations, parents, children, bookings, accounts, sessions, centres, centreMemberships, staffInvites, auditEvents, notifications } from '@/db/schema';
import { eq, or, inArray } from 'drizzle-orm';

/**
 * Cleanup script for test email addresses
 * 
 * This script removes all data associated with:
 * - dagenham@sydenhamasc.co.uk
 * - dagenhamafterschoolclub@gmail.com
 * 
 * WARNING: This action is IRREVERSIBLE.
 */

const TEST_EMAILS = [
    'dagenham@sydenhamasc.co.uk',
    'dagenhamafterschoolclub@gmail.com'
];

async function cleanupTestData() {
    console.log('🔍 Starting cleanup for test email addresses...');
    console.log('Test emails:', TEST_EMAILS);
    console.log('');

    try {
        // Step 1: Find users with these email addresses
        console.log('Step 1: Finding users...');
        const testUsers = await db
            .select()
            .from(users)
            .where(or(
                eq(users.email, TEST_EMAILS[0]),
                eq(users.email, TEST_EMAILS[1])
            ));

        if (testUsers.length === 0) {
            console.log('✅ No users found with these email addresses. Nothing to clean up.');
            return;
        }

        console.log(`Found ${testUsers.length} user(s):`);
        testUsers.forEach(user => {
            console.log(`  - ${user.email} (ID: ${user.id}, Role: ${user.role})`);
        });
        console.log('');

        const userIds = testUsers.map(u => u.id);
        const orgIds = testUsers.map(u => u.organisationId).filter(Boolean) as string[];

        // Step 2: Find related organisations
        if (orgIds.length > 0) {
            console.log('Step 2: Finding related organisations...');
            const relatedOrgs = await db
                .select()
                .from(organisations)
                .where(inArray(organisations.id, orgIds));

            console.log(`Found ${relatedOrgs.length} organisation(s):`);
            relatedOrgs.forEach(org => {
                console.log(`  - ${org.name} (Slug: ${org.slug})`);
            });
            console.log('');

            // Step 3: Find related parents
            console.log('Step 3: Finding related parents...');
            const relatedParents = await db
                .select()
                .from(parents)
                .where(inArray(parents.organisationId, orgIds));

            console.log(`Found ${relatedParents.length} parent(s)`);
            console.log('');

            // Step 4: Count related data
            console.log('Step 4: Counting related data...');

            const relatedCentres = await db
                .select()
                .from(centres)
                .where(inArray(centres.organisationId, orgIds));

            console.log(`  - ${relatedCentres.length} centres`);

            if (relatedParents.length > 0) {
                const parentIds = relatedParents.map(p => p.id);
                const relatedChildren = await db
                    .select()
                    .from(children)
                    .where(inArray(children.parentId, parentIds));

                console.log(`  - ${relatedChildren.length} children`);

                const relatedBookings = await db
                    .select()
                    .from(bookings)
                    .where(inArray(bookings.parentId, parentIds));

                console.log(`  - ${relatedBookings.length} bookings`);
            }
            console.log('');
        }

        // Confirmation prompt
        console.log('⚠️  WARNING: You are about to DELETE all data for these test accounts.');
        console.log('This action is IRREVERSIBLE and will cascade to:');
        console.log('  - Users and their authentication data (accounts, sessions)');
        console.log('  - Organisations they own');
        console.log('  - All centres under these organisations');
        console.log('  - All parents, children, and bookings');
        console.log('  - Centre memberships, staff invites, registrations');
        console.log('  - Audit events and notifications');
        console.log('');

        // In a real scenario, you'd prompt for confirmation here
        // For now, we'll require manual execution with a flag

        const shouldDelete = process.argv.includes('--confirm');

        if (!shouldDelete) {
            console.log('❌ Deletion NOT executed. To delete, run:');
            console.log('   tsx cleanup-test-data.ts --confirm');
            return;
        }

        // Execute deletions
        console.log('🗑️  Executing deletions...');
        console.log('');

        // Delete organisations (CASCADE will handle most related data)
        if (orgIds.length > 0) {
            console.log('Deleting organisations (this will cascade)...');
            await db
                .delete(organisations)
                .where(inArray(organisations.id, orgIds));
            console.log('✅ Organisations deleted');
        }

        // Delete users (CASCADE will handle accounts and sessions)
        console.log('Deleting users...');
        await db
            .delete(users)
            .where(inArray(users.id, userIds));
        console.log('✅ Users deleted');

        console.log('');
        console.log('🎉 Cleanup completed successfully!');
        console.log('');

        // Verify deletion
        console.log('Verifying deletion...');
        const remainingUsers = await db
            .select()
            .from(users)
            .where(or(
                eq(users.email, TEST_EMAILS[0]),
                eq(users.email, TEST_EMAILS[1])
            ));

        if (remainingUsers.length === 0) {
            console.log('✅ Verification passed: No users remain with these email addresses');
        } else {
            console.log('⚠️  WARNING: Some users still exist!');
            console.log(remainingUsers);
        }

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

// Run the cleanup
cleanupTestData()
    .then(() => {
        console.log('');
        console.log('Script completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
