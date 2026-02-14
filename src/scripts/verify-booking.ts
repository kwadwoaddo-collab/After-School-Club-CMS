
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, users, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkBooking() {
    const code = 'JOHNGY6ZUW';
    console.log(`Checking for booking with code: ${code}`);

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
            console.log('✅ Booking Found!');
            console.log('--- Booking Details ---');
            console.log(`ID: ${booking.id}`);
            console.log(`Status: ${booking.status}`);
            console.log(`Date: ${booking.startAt}`);
            console.log(`Centre: ${booking.centre?.name}`);
            console.log(`Parent: ${booking.parent.firstName} ${booking.parent.lastName} (${booking.parent.email})`);
            console.log('--- Attendees ---');
            booking.attendees.forEach(a => {
                console.log(`- ${a.child.firstName} ${a.child.lastName}`);
            });
        } else {
            console.log('❌ Booking NOT found.');
        }
    } catch (error) {
        console.error('Error querying database:', error);
    }
    process.exit(0);
}

checkBooking();
