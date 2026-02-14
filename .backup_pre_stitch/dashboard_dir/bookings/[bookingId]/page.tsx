import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import AppointmentScorecard from '@/features/bookings/components/AppointmentScorecard';
import Link from 'next/link';
import { ChevronLeft } from '@/components/ui/Icons';

interface BookingPageProps {
    params: Promise<{ bookingId: string }>;
}

export default async function BookingDetailPage({ params }: BookingPageProps) {
    const { bookingId } = await params;
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/login');
    }

    // First find the booking to identify the parent
    const initialBooking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
            parent: true,
            centre: true
        }
    });

    if (!initialBooking) {
        notFound();
    }

    // Security check
    if (!initialBooking.centre || initialBooking.centre.organisationId !== session.user.organisationId) {
        notFound();
    }

    const parentId = initialBooking.parentId;

    // Now fetch all bookings for this parent
    const parentBookings = await db.query.bookings.findMany({
        where: eq(bookings.parentId, parentId),
        orderBy: [desc(bookings.startAt)],
        with: {
            centre: true,
            parent: true,
            attendees: {
                with: {
                    child: {
                        with: {
                            subjects: true
                        }
                    }
                }
            },
            tutor: true,
            child: { // Deprecated: for legacy bookings before multi-child feature
                with: {
                    subjects: true
                }
            }
        }
    });

    // Filter to ensure all fetched bookings belong to the current organisation
    // Safely check b.centre is not null
    const validBookings = parentBookings.filter(b => b.centre && b.centre.organisationId === session.user.organisationId);

    // Group bookings by centre name
    const groupedBookings: Record<string, typeof validBookings> = {};
    validBookings.forEach((b) => {
        if (!b.centre) return;
        const centreName = b.centre.name;
        if (!groupedBookings[centreName]) {
            groupedBookings[centreName] = [];
        }
        groupedBookings[centreName].push(b);
    });

    // Sort centre names alphabetically
    const sortedCentreNames = Object.keys(groupedBookings).sort();

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-3xl mx-auto">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-6 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    ← Back to Dashboard
                </Link>

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Booking Record</h1>
                        <p className="text-gray-500 mt-1">
                            For {initialBooking.parent.firstName} {initialBooking.parent.lastName}
                        </p>
                    </div>
                </div>

                <div className="space-y-10">
                    {sortedCentreNames.map((centreName) => (
                        <div key={centreName} className="space-y-4">
                            <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2">
                                {centreName}
                            </h2>
                            <div className="space-y-6">
                                {groupedBookings[centreName].map((b) => (
                                    <AppointmentScorecard
                                        key={b.id}
                                        booking={b as any}
                                        defaultExpanded={b.id === bookingId}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {sortedCentreNames.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                            <p className="text-gray-500">No confirmed bookings found for this organisation.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
