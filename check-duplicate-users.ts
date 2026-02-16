import { db } from './src/db/index';
import { users, accounts } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function checkDuplicateUsers() {
    console.log('Checking for duplicate users and account linkages...\n');

    const email = 'kwadwoaddo@googlemail.com';

    // Find all users with this email
    const allUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

    console.log(`Found ${allUsers.length} user(s) with email: ${email}`);

    for (const user of allUsers) {
        console.log(`\nUser ID: ${user.id}`);
        console.log(`Name: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Email Verified: ${user.emailVerified}`);
        console.log(`Created: ${user.createdAt}`);

        // Find linked accounts
        const linkedAccounts = await db
            .select()
            .from(accounts)
            .where(eq(accounts.userId, user.id));

        console.log(`Linked accounts: ${linkedAccounts.length}`);
        for (const account of linkedAccounts) {
            console.log(`  - Provider: ${account.provider}, Account ID: ${account.providerAccountId}`);
        }
    }

    // Find all Google accounts for this email
    const googleAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.provider, 'google'));

    console.log(`\nAll Google accounts in database: ${googleAccounts.length}`);
    for (const account of googleAccounts) {
        console.log(`  Provider Account ID: ${account.providerAccountId}`);
        console.log(`  Linked to User ID: ${account.userId}`);
    }

    process.exit(0);
}

checkDuplicateUsers().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
