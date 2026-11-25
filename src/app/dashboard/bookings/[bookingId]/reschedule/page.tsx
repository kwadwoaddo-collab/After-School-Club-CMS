/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import RescheduleForm from '@/features/bookings/components/RescheduleForm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';
import { Card } from '@/components/ui/Card';

export default async function ReschedulePage({ params }: { params: Promise<{ bookingId: string }> }) {
    const session = await requireTenantSession();
    const { bookingId } = await params;

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = ((session.user as any).role as string | undefined) || 'TUTOR';
    if (userRole === 'TUTOR' || !['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
        return redirect('/dashboard/attendance');
    }

    if (!isValidUuid(bookingId)) {
        return notFound();
    }

    const [[booking], rawAccessibleCentreIds] = await Promise.all([
        db
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
            .limit(1),
        userRole !== 'ORG_OWNER'
            ? getUserAccessibleCentreIds(session.user.id)
            : Promise.resolve([]),
    ]);

    if (!booking) {
        return notFound();
    }

    // Organisation-ownership check
    if (!booking.centreOrganisationId || booking.centreOrganisationId !== session.user.organisationId) {
        return redirect('/dashboard/bookings');
    }

    // Centre-membership check for non-ORG_OWNER users (DC-02)
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = (rawAccessibleCentreIds ?? []).filter(isValidUuid);
        if (accessibleCentreIds.length === 0 || (booking.centreId !== null && booking.centreId !== undefined && !accessibleCentreIds.includes(booking.centreId))) {
            return notFound();
        }
    }

    const attendees = await db
        .select({
            childId: children.id,
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
                    aria-label="Back to booking details"
                    className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 rounded-sm text-text-muted hover:text-text hover:bg-page transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-page-title text-text">Reschedule Booking</h1>
                    <p className="text-text-secondary text-small-body mt-0.5">
                        Select a new date and time for{' '}
                        {firstChild?.childId ? (
                            <Link href={`/dashboard/students/${firstChild.childId}`} className="text-accent hover:underline font-medium">
                                {firstChild.childFirstName || 'child'} {firstChild.childLastName || ''}
                            </Link>
                        ) : (
                            <span>{firstChild?.childFirstName || 'child'} {firstChild?.childLastName || ''}</span>
                        )}
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
