import 'dotenv/config';
import { db } from '../db';
import { users, organisations, centres, bookings } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const email = 'kwadwoaddo@googlemail.com';
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (user.length === 0) {
        console.log('User not found:', email);
        return;
    }

    const userData = user[0];
    console.log('--- USER DATA ---');
    console.log('User:', JSON.stringify(userData, null, 2));

    if (userData.organisationId) {
        const org = await db.select().from(organisations).where(eq(organisations.id, userData.organisationId)).limit(1);
        console.log('\n--- ORGANISATION ---');
        console.log(JSON.stringify(org[0], null, 2));

        const orgCentres = await db.select().from(centres).where(eq(centres.organisationId, userData.organisationId));
        console.log('\n--- CENTRES ---');
        console.log(`Found ${orgCentres.length} centres`);

        for (const centre of orgCentres) {
            const bookingsData = await db.select().from(bookings).where(eq(bookings.centreId, centre.id)).limit(1);
            console.log(`Centre "${centre.name}" has at least ${bookingsData.length} bookings`);
        }
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
