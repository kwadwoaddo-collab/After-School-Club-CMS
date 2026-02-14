
import 'dotenv/config';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

async function checkUser() {
    const email = 'kaddo@sydenahmasc.co.uk';
    console.log(`Checking for user: ${email}`);

    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: {
            organisation: true,
        }
    });

    if (user) {
        console.log('User FOUND.');
        console.log(`ID: ${user.id}`);
        console.log(`Role: ${user.role}`);
        console.log(`Organisation ID: ${user.organisationId}`);
        if (user.organisation) {
            console.log(`Organisation Name: ${user.organisation.name}`);
        } else {
            console.log('No Organisation linked.');
        }
    } else {
        console.log('User NOT FOUND.');
    }

    process.exit(0);
}

checkUser().catch((err) => {
    console.error('Error checking user:', err);
    process.exit(1);
});
