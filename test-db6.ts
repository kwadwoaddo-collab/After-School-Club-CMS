import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
    const { db } = await import('./src/db/index.js');
    const { bookings } = await import('./src/db/schema.js');
    const { desc } = await import('drizzle-orm');

    try {
        const bookingsList = await db.query.bookings.findMany({ limit: 1 });
        if (bookingsList.length === 0) {
            console.log("No bookings found in DB AT ALL.");
            process.exit(0);
        }
        
        const centreId = bookingsList[0].centreId;
        const centreIds = [centreId];

        console.log(`Testing with real centreId: ${centreId}`);

        const res = await db.query.bookings.findMany({
            where: (b: any, op: any) => {
                const conds = [op.inArray(b.centreId, centreIds)];
                return conds.length === 1 ? conds[0] : op.and(...conds);
            },
            orderBy: [desc(bookings.startAt)],
            with: {
                centre: true,
                parent: true,
                attendees: {
                    with: {
                        child: {
                            with: {
                                notes: true
                            }
                        }
                    }
                },
                tutor: true,
                child: {
                    with: {
                        notes: true
                    }
                }
            }
        });
        
        console.log(`Query found: ${res.length} bookings.`);
        if (res.length > 0) {
            console.log("Success! No error thrown.");
        }
    } catch (e) {
        console.error('Error in query:', e);
    }
    process.exit(0);
}
run();
