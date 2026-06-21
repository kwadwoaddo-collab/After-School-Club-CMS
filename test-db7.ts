import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
    const { db } = await import('./src/db/index.js');
    const { bookings, organisations, centres } = await import('./src/db/schema.js');
    const { desc, eq, inArray } = await import('drizzle-orm');

    try {
        const orgId = "ca07842a-a9f8-45e0-8195-23c21c754024"; // Any valid orgId

        const orgCentres = await db.select().from(centres);
        const centreIds = orgCentres.map(c => c.id);

        const searchParams: any = { status: undefined, centre: undefined };

        console.log("Centre IDs count:", centreIds.length);

        if (centreIds.length === 0) {
            console.log("No centres.");
            return;
        }

        const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

        function normalizeEnum(param: any, allowedValues: any, fallback: any) {
            const value = param;
            if (value && allowedValues.includes(value)) {
                return value;
            }
            return fallback;
        }

        const bookingsData = await db.query.bookings.findMany({
            where: (b: any, op: any) => {
                const conds = [op.inArray(b.centreId, centreIds)];
                
                if (searchParams.centre && searchParams.centre !== 'all') {
                    if (centreIds.includes(searchParams.centre as string)) {
                        conds.push(op.eq(b.centreId, searchParams.centre as string));
                    } else {
                        conds.push(op.eq(b.centreId, 'unauthorized_centre_id'));
                    }
                }

                if (searchParams.status && searchParams.status !== 'all') {
                    const statusParam = normalizeEnum(searchParams.status, VALID_BOOKING_STATUSES, 'all');
                    if (statusParam !== 'all') {
                        conds.push(op.eq(b.status, statusParam));
                    }
                }

                return conds.length === 1 ? conds[0] : op.and(...conds);
            },
            orderBy: [desc(bookings.startAt)],
            with: {
                centre: true,
                parent: true,
                tutor: true,
                child: {
                    with: {
                        notes: true
                    }
                }
            }
        });

        console.log(`Query fetched ${bookingsData.length} records.`);

    } catch (e) {
        console.error('Error in query:', e);
    }
    process.exit(0);
}
run();
