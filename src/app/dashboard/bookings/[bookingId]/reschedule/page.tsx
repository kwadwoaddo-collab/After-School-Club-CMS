import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import RescheduleForm from '@/components/bookings/RescheduleForm';

export default async function ReschedulePage({ params }: { params: Promise<{ bookingId: string }> }) {
    const session = await auth();
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
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href={`/dashboard/bookings/${bookingId}`}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-white/60 hover:text-white" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Reschedule Booking</h1>
                    <p className="text-slate-400 font-medium mt-1">
                        Select a new date and time for {firstChild?.childFirstName || 'child'} {firstChild?.childLastName || ''}
                    </p>
                </div>
            </div>

            {/* Current Booking Info */}
            <div className="glassmorphic-card rounded-[32px] p-8">
                <h3 className="text-lg font-bold text-white mb-4">Current Booking</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-300">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="font-medium">
                            {booking.startAt && !isNaN(new Date(booking.startAt).getTime()) ? format(new Date(booking.startAt), 'EEEE, MMMM d, yyyy') : 'Date TBD'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                        <Clock className="w-5 h-5 text-primary" />
                        <span className="font-medium">
                            {booking.startAt && !isNaN(new Date(booking.startAt).getTime()) ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}
                        </span>
                    </div>
                </div>
            </div>

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
