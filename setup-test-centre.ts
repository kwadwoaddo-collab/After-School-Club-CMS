import { db } from './src/db';
import { centres, centreAvailabilityRules } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    console.log('Fetching centres...');
    const allCentres = await db.select().from(centres);
    if (allCentres.length === 0) {
        console.log('No centres found');
        process.exit(1);
    }
    const centre = allCentres[0];
    console.log(`Setting rules for centre: ${centre.name} (${centre.id})`);
    
    // delete old rules
    await db.delete(centreAvailabilityRules).where(eq(centreAvailabilityRules.centreId, centre.id));
    
    // insert new rules for every day to open at 11:00 and close at 18:00
    for (let i = 0; i < 7; i++) {
        await db.insert(centreAvailabilityRules).values({
            centreId: centre.id,
            dayOfWeek: i,
            startTime: '11:00',
            endTime: '18:00'
        });
    }
    console.log('Done mapping rules. URL for booking should be /book/' + centre.slug);
    process.exit(0);
}

main().catch(console.error);
