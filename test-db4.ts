import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
    const { db } = await import('./src/db/index.js');

    try {
        const centres = await db.query.centres.findMany({ limit: 1 });
        if (centres.length === 0) {
            console.log("No centres found in DB.");
            process.exit(0);
        }
        
        const centreId = centres[0].id;
        console.log(`Testing with real centreId: ${centreId}`);

        const res1 = await db.query.bookings.findMany({
            where: (b: any, op: any) => op.inArray(b.centreId, [centreId])
        });
        console.log(`Base Query (only inArray centreId) found: ${res1.length}`);

        const res2 = await db.query.bookings.findMany({
            where: (b: any, op: any) => {
                const conds = [op.inArray(b.centreId, [centreId])];
                return conds.length === 1 ? conds[0] : op.and(...conds);
            }
        });
        console.log(`With return conds.length === 1 ? conds[0] : op.and(...conds) found: ${res2.length}`);

        console.log("All OK");
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
run();
