import { db } from './src/db';
import { bookings, centres } from './src/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

async function run() {
    try {
        const centreIds = ['5846fb8b-ecb5-4b06-ac6b-967a544f0b2f']; // dummy uuid
        console.log('Fetching bookings...');
        const b = await db.query.bookings.findMany({
            where: (b, op) => op.inArray(b.centreId, centreIds),
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
        console.log(b.length);
    } catch (e) {
        console.error(e);
    }
}
run();
