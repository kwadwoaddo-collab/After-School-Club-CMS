/**
 * Script to diagnose and fix OAuth account linking issues
 * 
 * This script will:
 * 1. Find all users with the specified email
 * 2. Find all Google accounts in the database
 * 3. Identify which user should be the primary one
 * 4. Update Google account to link to the correct user
 * 5. Optionally merge/delete duplicate users
 */

import { db } from './src/db/index';
import { users, accounts } from './src/db/schema';
import { eq, and } from 'drizzle-orm';

const TARGET_EMAIL = 'kwadwoaddo@googlemail.com';

async function diagnoseAndFix() {
    console.log('🔍 Starting OAuth Account Diagnostic...\n');
    console.log(`Target email: ${TARGET_EMAIL}\n`);

    // Step 1: Find all users with this email
    console.log('Step 1: Finding all users with this email...');
    const allUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, TARGET_EMAIL));

    console.log(`✓ Found ${allUsers.length} user(s)\n`);

    if (allUsers.length === 0) {
        console.log('❌ No users found with this email. Exiting.');
        process.exit(0);
    }

    // Display all users
    allUsers.forEach((user, index) => {
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Email Verified: ${user.emailVerified}`);
        console.log(`  Organisation ID: ${user.organisationId}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Created: ${user.createdAt}`);
        console.log(`  Has Password: ${user.passwordHash ? 'Yes' : 'No'}`);
        console.log('');
    });

    // Step 2: Find accounts linked to each user
    console.log('Step 2: Finding linked accounts for each user...');
    for (const user of allUsers) {
        const linkedAccounts = await db
            .select()
            .from(accounts)
            .where(eq(accounts.userId, user.id));

        console.log(`User ${user.id} has ${linkedAccounts.length} linked account(s):`);
        linkedAccounts.forEach((account) => {
            console.log(`  - ${account.provider} (${account.providerAccountId})`);
        });
        console.log('');
    }

    // Step 3: Find all Google accounts
    console.log('Step 3: Finding all Google accounts in database...');
    const allGoogleAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.provider, 'google'));

    console.log(`✓ Found ${allGoogleAccounts.length} Google account(s) total\n`);

    // Step 4: Check for Google accounts linked to our target email
    const googleAccountsForEmail = allGoogleAccounts.filter((account) => {
        return allUsers.some((user) => user.id === account.userId);
    });

    if (googleAccountsForEmail.length > 0) {
        console.log('Google accounts linked to our target email users:');
        googleAccountsForEmail.forEach((account) => {
            console.log(`  Provider Account ID: ${account.providerAccountId}`);
            console.log(`  Linked to User ID: ${account.userId}`);
            console.log('');
        });
    }

    // Step 5: Determine the primary user (most recent with organisation)
    console.log('Step 5: Determining primary user...');
    const primaryUser = allUsers.reduce((prev, current) => {
        // Prefer user with organisation
        if (current.organisationId && !prev.organisationId) return current;
        if (!current.organisationId && prev.organisationId) return prev;

        // Prefer user with more data
        if (current.passwordHash && !prev.passwordHash) return current;
        if (!current.passwordHash && prev.passwordHash) return prev;

        // Fallback to most recent
        return new Date(current.createdAt!) > new Date(prev.createdAt!) ? current : prev;
    });

    console.log(`✓ Primary user determined: ${primaryUser.id}`);
    console.log(`  Name: ${primaryUser.name}`);
    console.log(`  Organisation: ${primaryUser.organisationId || 'None'}`);
    console.log(`  Role: ${primaryUser.role}\n`);

    // Step 6: Check if we need to fix anything
    const needsFix = allUsers.length > 1 || googleAccountsForEmail.length === 0;

    if (!needsFix) {
        console.log('✓ No issues detected. Everything looks good!');
        process.exit(0);
    }

    console.log('⚠️  Issues detected. Recommended actions:\n');

    if (allUsers.length > 1) {
        console.log(`📋 Action 1: Merge ${allUsers.length} duplicate users into one`);
        console.log(`   Primary User ID: ${primaryUser.id}`);
        console.log(`   Users to merge: ${allUsers.filter(u => u.id !== primaryUser.id).map(u => u.id).join(', ')}\n`);
    }

    if (googleAccountsForEmail.length === 0) {
        console.log('📋 Action 2: No Google account linked yet');
        console.log('   This will be automatically linked on next Google sign-in\n');
    } else if (googleAccountsForEmail.some(acc => acc.userId !== primaryUser.id)) {
        console.log('📋 Action 3: Update Google account to link to primary user');
        const wrongAccount = googleAccountsForEmail.find(acc => acc.userId !== primaryUser.id);
        if (wrongAccount) {
            console.log(`   Current link: ${wrongAccount.userId}`);
            console.log(`   Should be: ${primaryUser.id}\n`);
        }
    }

    console.log('\n⚠️  This is a READ-ONLY diagnostic.');
    console.log('To apply fixes, run: npx tsx fix-oauth-accounts.ts --apply\n');

    // If --apply flag is provided, apply the fixes
    const shouldApply = process.argv.includes('--apply');

    if (shouldApply) {
        console.log('🔧 Applying fixes...\n');

        // Fix 1: Update Google accounts to link to primary user
        for (const account of googleAccountsForEmail) {
            if (account.userId !== primaryUser.id) {
                console.log(`Updating Google account ${account.providerAccountId}...`);
                await db
                    .update(accounts)
                    .set({ userId: primaryUser.id })
                    .where(
                        and(
                            eq(accounts.provider, 'google'),
                            eq(accounts.providerAccountId, account.providerAccountId)
                        )
                    );
                console.log('✓ Updated');
            }
        }

        // Fix 2: Merge duplicate users (keep primary, delete others)
        if (allUsers.length > 1) {
            const duplicateUsers = allUsers.filter(u => u.id !== primaryUser.id);

            for (const duplicateUser of duplicateUsers) {
                console.log(`\nMerging user ${duplicateUser.id}...`);

                // Move accounts from duplicate to primary
                const duplicateAccounts = await db
                    .select()
                    .from(accounts)
                    .where(eq(accounts.userId, duplicateUser.id));

                for (const account of duplicateAccounts) {
                    console.log(`  Moving ${account.provider} account...`);
                    await db
                        .update(accounts)
                        .set({ userId: primaryUser.id })
                        .where(
                            and(
                                eq(accounts.userId, duplicateUser.id),
                                eq(accounts.provider, account.provider)
                            )
                        );
                }

                // Delete duplicate user
                console.log(`  Deleting duplicate user ${duplicateUser.id}...`);
                await db
                    .delete(users)
                    .where(eq(users.id, duplicateUser.id));

                console.log('✓ Merged and deleted');
            }
        }

        console.log('\n✅ All fixes applied successfully!');
        console.log('You can now try signing in with Google again.\n');
    }

    process.exit(0);
}

diagnoseAndFix().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
