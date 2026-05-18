import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
    const { db } = await import('./src/db/index.js');

    try {
        const bookings = await db.query.bookings.findMany({ limit: 5 });
        if (bookings.length === 0) {
            console.log("No bookings found in DB AT ALL.");
        } else {
            console.log(`Found ${bookings.length} bookings.`);
            console.log("First booking:", bookings[0]);
        }
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
run();
