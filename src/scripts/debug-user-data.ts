import 'dotenv/config';
import { db } from '../db';
import { users, organisations, centres, bookings } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const email = 'kwadwoaddo@googlemail.com';
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: { organisation: true }
    });

    if (!user) {
        console.log('User not found:', email);
        return;
    }

    console.log('--- USER DATA ---');
    console.log('User ID:', user.id);
    console.log('Name:', user.firstName, user.lastName);
    console.log('Organisation:', user.organisation?.name || 'None');
    console.log('Organisation ID:', user.organisationId);

    if (user.organisationId) {
        const orgCentres = await db.select().from(centres).where(eq(centres.organisationId, user.organisationId));
        console.log('\n--- CENTRES ---');
        console.log(JSON.stringify(orgCentres, null, 2));

        const orgBookings = await db.select()
            .from(bookings)
            .innerJoin(centres, eq(bookings.centreId, centres.id))
            .where(eq(centres.organisationId, user.organisationId));
        console.log('\n--- BOOKINGS ---');
        console.log('Count:', orgBookings.length);
    }
}

main().catch(console.error);
