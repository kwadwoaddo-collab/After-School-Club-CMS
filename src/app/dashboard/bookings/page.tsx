import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, bookings, bookingAttendees, centres, parents, children, users } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { BookingList } from '@/features/bookings';

export default async function BookingsPage() {
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/login');
    }

    const orgId = session.user.organisationId;

    // Fetch all bookings for the organisation's centres
    // We need to join through multiple tables to get full details
    // Strategy: Fetch bookings where centre belongs to org

    // 1. Get Centre IDs for this Org
    const orgCentres = await db
        .select({ id: centres.id })
        .from(centres)
        .where(eq(centres.organisationId, orgId));

    const centreIds = orgCentres.map(c => c.id);

    if (centreIds.length === 0) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold mb-6 text-gray-900">Bookings</h1>
                <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-gray-200">
                    <p className="text-gray-500">No centres found. Please set up a centre first.</p>
                </div>
            </div>
        );
    }

    // 2. Fetch Bookings with relations
    // Since Drizzle's query builder is powerful, let's try to use it if relations are set up correctly
    // Otherwise manually join. The schema shows relations are defined.

    // However, `findMany` with deeply nested relations and `where` filters on related tables (like centre.orgId) can be tricky or slow if not carefully constructed.
    // Let's filter by centreId directly since we have the IDs.

    /* 
       We need: 
       - Booking
       - Centre
       - Parent
       - Attendees -> Child
       - Tutor (User)
    */

    const bookingsData = await db.query.bookings.findMany({
        where: (bookings, { inArray }) => inArray(bookings.centreId, centreIds),
        orderBy: [desc(bookings.startAt)],
        with: {
            centre: true,
            parent: true,
            attendees: {
                with: {
                    child: true
                }
            },
            tutor: true,
            child: true // Deprecated: for legacy bookings before multi-child feature
        }
    });

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                        <p className="text-gray-500 text-sm">Manage upcoming and past appointments</p>
                    </div>
                    <a
                        href="/dashboard"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors mt-2"
                    >
                        ← Back to Dashboard
                    </a>
                </header>

                <BookingList bookings={bookingsData as any} />
            </div>
        </div>
    );
}
