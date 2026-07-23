import { logger } from '@/lib/logger';

import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, users, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkBooking() {
    const code = 'JOHNGY6ZUW';
    logger.info(`Checking for booking with code: ${code}`);

    try {
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.confirmationCode, code),
            with: {
                parent: true,
                centre: true,
                attendees: {
                    with: {
                        child: true
                    }
                }
            }
        });

        if (booking) {
            logger.info('✅ Booking Found!');
            logger.info('--- Booking Details ---');
            logger.info(`ID: ${booking.id}`);
            logger.info(`Status: ${booking.status}`);
            logger.info(`Date: ${booking.startAt}`);
            logger.info(`Centre: ${booking.centre?.name}`);
            logger.info(`Parent: ${booking.parent.firstName} ${booking.parent.lastName} (${booking.parent.email})`);
            logger.info('--- Attendees ---');
            booking.attendees.forEach(a => {
                logger.info(`- ${a.child.firstName} ${a.child.lastName}`);
            });
        } else {
            logger.info('❌ Booking NOT found.');
        }
    } catch (error) {
        logger.error('Error querying database:', error);
    }
    process.exit(0);
}

checkBooking();
