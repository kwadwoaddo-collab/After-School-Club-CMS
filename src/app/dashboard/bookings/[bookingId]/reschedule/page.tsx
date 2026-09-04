/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import RescheduleForm from '@/features/bookings/components/RescheduleForm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { Card } from '@/components/ui/Card';

export default async function ReschedulePage({ params }: { params: Promise<{ bookingId: string }> }) {
    const session = await requireTenantSession();
    const { bookingId } = await params;

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    // Fetch booking details with attendees
    const [booking] = await db
        .select({
            id: bookings.id,
            startAt: bookings.startAt,
            duration: bookings.duration,
            modality: bookings.modality,
            status: bookings.status,
            parentFirstName: parents.firstName,
            parentLastName: parents.lastName,
            parentEmail: parents.email,
            centreName: centres.name,
            centreId: centres.id,
            centreOrganisationId: centres.organisationId,
            centreOperatingHours: centres.operatingHours,
        })
        .from(bookings)
        .leftJoin(parents, eq(bookings.parentId, parents.id))
        .leftJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(bookings.id, bookingId))
        .limit(1);

    if (!booking) {
        return redirect('/dashboard/bookings');
    }

    // Organisation-ownership check — this page previously had none at all
    // (unlike Booking Detail, which at least checked organisation match).
    // A booking with no centre (centreOrganisationId null) has no
    // resolvable organisation and is treated as inaccessible.
    if (!booking.centreOrganisationId || booking.centreOrganisationId !== session.user.organisationId) {
        return redirect('/dashboard/bookings');
    }

    // Centre-membership check for non-ORG_OWNER users — matches the check
    // already enforced by the reschedule mutation
    // (POST /api/bookings/[bookingId]/reschedule) and by Booking Detail.
    const userRole = (session.user as any).role as string | undefined;
    if (userRole !== 'ORG_OWNER' && booking.centreId) {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(booking.centreId)) {
            return redirect('/dashboard/bookings');
        }
    }

    // Fetch attendees separately
    const attendees = await db
        .select({
            childFirstName: children.firstName,
            childLastName: children.lastName,
        })
        .from(bookingAttendees)
        .leftJoin(children, eq(bookingAttendees.childId, children.id))
        .where(eq(bookingAttendees.bookingId, bookingId));

    const firstChild = attendees[0];

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href={`/dashboard/bookings/${bookingId}`}
                    className="p-2 rounded-sm text-text-muted hover:text-text hover:bg-page transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-page-title text-text">Reschedule Booking</h1>
                    <p className="text-text-secondary text-small-body mt-0.5">
                        Select a new date and time for {firstChild?.childFirstName || 'child'} {firstChild?.childLastName || ''}
                    </p>
                </div>
            </div>

            {/* Current Booking Info */}
            <Card className="p-6">
                <h3 className="text-section-title text-text mb-4">Current Booking</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-text">
                        <Calendar className="w-4 h-4 text-accent" />
                        <span className="text-small-body font-medium">
                            {booking.startAt && !isNaN(new Date(booking.startAt).getTime()) ? format(new Date(booking.startAt), 'EEEE, MMMM d, yyyy') : 'Date TBD'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-text">
                        <Clock className="w-4 h-4 text-accent" />
                        <span className="text-small-body font-medium">
                            {booking.startAt && !isNaN(new Date(booking.startAt).getTime()) ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}
                        </span>
                    </div>
                </div>
            </Card>

            {/* Reschedule Form */}
            <RescheduleForm
                bookingId={bookingId}
                currentDate={booking.startAt && !isNaN(new Date(booking.startAt).getTime()) ? format(new Date(booking.startAt), 'yyyy-MM-dd') : ''}
                currentTime={booking.startAt && !isNaN(new Date(booking.startAt).getTime()) ? format(new Date(booking.startAt), 'HH:mm') : ''}
                operatingHours={booking.centreOperatingHours}
            />
        </div>
    );
}
