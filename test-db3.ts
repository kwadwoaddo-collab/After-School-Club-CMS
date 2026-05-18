import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
    const { db } = await import('./src/db/index.js');
    const { bookings } = await import('./src/db/schema.js');
    const { desc } = await import('drizzle-orm');
    const { normalizeEnum } = await import('./src/lib/search-params.js');

    const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

    try {
        const rawSearchParams: any = {};
        
        const searchParams = {
            status: Array.isArray(rawSearchParams.status) ? rawSearchParams.status[0] : rawSearchParams.status,
        };

        const centreIds = ['5846fb8b-ecb5-4b06-ac6b-967a544f0b2f']; // using a dummy centre ID to see if it works

        const res = await db.query.bookings.findMany({
            where: (b: any, op: any) => {
                const conds: any[] = [op.inArray(b.centreId, centreIds)];
                
                if (searchParams.status && searchParams.status !== 'all') {
                    const statusParam = normalizeEnum(searchParams.status, VALID_BOOKING_STATUSES, 'all');
                    if (statusParam !== 'all') {
                        conds.push(op.eq(b.status, statusParam));
                    }
                }
                
                return conds.length === 1 ? conds[0] : op.and(...conds);
            },
            limit: 5
        });
        console.log('Bookings found:', res.length);
        console.log('Status query executed successfully.');
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
run();
