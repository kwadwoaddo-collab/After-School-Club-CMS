import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from './src/db';
import { bookings } from './src/db/schema';
import { desc } from 'drizzle-orm';
import { normalizeEnum } from './src/lib/search-params';

const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

async function run() {
    try {
        const rawSearchParams = { status: 'confirmed' };
        
        const searchParams = {
            status: Array.isArray(rawSearchParams.status) ? rawSearchParams.status[0] : rawSearchParams.status,
        };

        const res = await db.query.bookings.findMany({
            where: (b, op) => {
                const conds: any[] = [];
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
}
run();
