import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock, MapPin, User, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import MarkAttendedButton from '@/components/bookings/MarkAttendedButton';
import StudentNotesPanel from '@/components/students/StudentNotesPanel';
import InternalNotesTimeline from '@/components/students/InternalNotesTimeline';
import { getStudentNotes } from '@/features/students/notes.actions';
import { getUserAccessibleCentres } from '@/lib/permissions';
import ReassignCentreButton from '@/components/bookings/ReassignCentreButton';
import { isFeatureEnabled } from '@/lib/feature-flags';
import AttendanceDropdown from './AttendanceDropdown';
import type { AttendanceStatus } from '@/lib/attendance';

interface BookingPageProps {
    params: Promise<{ bookingId: string }>;
}

export default async function BookingDetailPage({ params }: BookingPageProps) {
    const { bookingId } = await params;
    const session = await auth();
    if (!session?.user?.organisationId) redirect('/login');

    // Skip query if this is 'new'
    if (bookingId === 'new') return notFound();

    // Basic UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) return notFound();

    // Fetch the booking
    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
            parent: true,
            centre: true,
            attendees: {
                with: {
                    child: {
                        with: {
                            notes: {
                                orderBy: (notes, { desc }) => [desc(notes.createdAt)]
                            }
                        }
                    }
                }
            },
            tutor: true,
            child: {
                with: {
                    notes: {
                        orderBy: (notes, { desc }) => [desc(notes.createdAt)]
                    }
                }
            }
        }
    });

    if (!booking) return notFound();

    // Security check
    if (!booking.centre || booking.centre.organisationId !== session.user.organisationId) {
        return notFound();
    }

    const orgCentres = await getUserAccessibleCentres(session.user.id);

    // Task 32: colour/label map aligned with BookingsTable (DB enum: confirmed | cancelled | rescheduled | completed | pending)
    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; ring: string; label: string }> = {
            confirmed:   { bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-600/20',   label: 'Booked' },
            pending:     { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-600/20',  label: 'Pending' },
            // 'completed' is stored in DB; displayed as 'Attended'
            completed:   { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-600/20', label: 'Attended' },
            rescheduled: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-600/20', label: 'Rescheduled' },
            cancelled:   { bg: 'bg-slate-100', text: 'text-slate-600',  ring: 'ring-slate-600/20',  label: 'Cancelled' },
        };

        const style = styles[status] || styles.pending;
        return (
            <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ring-1 ${style.bg} ${style.text} ${style.ring}`}>
                {style.label}
            </span>
        );
    };

    const getStudentInfo = () => {
        if (booking.attendees && booking.attendees.length > 0) {
            const child = booking.attendees[0].child;
            return {
                id: child.id,
                name: `${child.firstName} ${child.lastName}`,
                grade: child.schoolYear,
                dob: child.dateOfBirth,
                initials: `${child.firstName[0]}${child.lastName[0]}`.toUpperCase()
            };
        }
        if (booking.child) {
            return {
                id: booking.child.id,
                name: `${booking.child.firstName} ${booking.child.lastName}`,
                grade: booking.child.schoolYear,
                dob: booking.child.dateOfBirth,
                initials: `${booking.child.firstName[0]}${booking.child.lastName[0]}`.toUpperCase()
            };
        }
        return { id: '', name: 'Unknown Student', grade: null, dob: null, initials: '?' };
    };

    const student = getStudentInfo();
    const initialNotes = student.id ? await getStudentNotes(student.id) : [];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/bookings"
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </Link>
                {/* Task 34: high-contrast text for dark dashboard background */}
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Booking Details</h1>
                    <p className="text-slate-300 font-medium mt-1">
                        View and manage assessment booking
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/bookings/${bookingId}/reschedule`}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-sm font-semibold text-slate-700 transition-all"
                    >
                        Reschedule
                    </Link>
                    {/* Task 5: Interactive Mark as Attended button — updates status to 'completed' via PATCH API */}
                    <MarkAttendedButton bookingId={bookingId} initialStatus={booking.status} />
                </div>
            </div>
            {/* Attendees List */}
            <div className="space-y-6">
                {booking.attendees && booking.attendees.length > 0 ? (
                    booking.attendees.map(attendee => {
                        const child = attendee.child;
                        const initials = `${child.firstName[0]}${child.lastName[0]}`.toUpperCase();
                        
                        return (
                            <div key={attendee.id} className="glass-card rounded-[32px] p-8 !bg-[#1a1c23]/80 !border-[#2a2d35]">
                                <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                            {initials}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-2">{child.firstName} {child.lastName}</h2>
                                            <div className="flex flex-wrap items-center gap-4">
                                                <span className="px-3 py-1 bg-primary/10 text-primary rounded-xl text-xs font-bold uppercase">
                                                    {child.schoolYear || 'Grade N/A'}
                                                </span>
                                                {child.dateOfBirth && (
                                                    <span className="text-sm text-slate-500 font-medium">
                                                        Born: {format(new Date(child.dateOfBirth), 'MMM d, yyyy')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-4 min-w-[250px]">
                                        {getStatusBadge(booking.status)}
                                        {isFeatureEnabled('GRANULAR_ATTENDANCE') && (
                                            <div className="w-full">
                                                <AttendanceDropdown 
                                                    bookingId={bookingId}
                                                    attendeeId={attendee.id}
                                                    currentAttendanceStatus={attendee.attendanceStatus as AttendanceStatus | null}
                                                    currentBookingStatus={booking.status}
                                                    currentNote={attendee.attendanceNote}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                {/* Booking Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-200">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Assessment Date
                            </p>
                            <p className="text-lg font-bold text-white">
                                {booking.startAt ? format(new Date(booking.startAt), 'EEE, MMM d, yyyy') : 'Date TBD'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent-violet/10 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-6 h-6 text-accent-violet" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Time Slot
                            </p>
                            <p className="text-lg font-bold text-white">
                                {booking.startAt
                                    ? format(new Date(booking.startAt), 'h:mm a')
                                    : 'Time TBD'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-6 h-6 text-accent-cyan" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Location
                            </p>
                            <p className="text-lg font-bold text-white flex items-center">
                                {booking.centre.name}
                                <ReassignCentreButton 
                                    bookingId={booking.id} 
                                    currentCentreId={booking.centreId || ''} 
                                    centres={orgCentres} 
                                />
                            </p>
                        </div>
                    </div>
                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="glass-card rounded-[32px] p-8 !bg-[#1a1c23]/80 !border-[#2a2d35]">
                        <p className="text-white text-center">No attendees found for this booking.</p>
                    </div>
                )}
            </div>

            {/* Parent Information */}
            <div className="glass-card rounded-3xl p-8 !bg-[#1a1c23]/80 !border-[#2a2d35]">
                <h3 className="text-xl font-bold text-white mb-6">Parent Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Parent Name
                            </p>
                            <p className="text-base font-bold text-white">
                                {booking.parent.firstName} {booking.parent.lastName}
                            </p>
                            <p className="text-xs text-primary font-semibold mt-1">
                                Assessment Point of Contact
                            </p>
                        </div>
                    </div>

                    {booking.parent.phone && (
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <Phone className="w-6 h-6 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Phone
                                </p>
                                <a href={`tel:${booking.parent.phone}`} className="text-base font-bold text-white hover:text-primary transition-colors">
                                    {booking.parent.phone}
                                </a>
                            </div>
                        </div>
                    )}

                    {booking.parent.email && (
                        <div className="flex items-center gap-4 md:col-span-2">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <Mail className="w-6 h-6 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Email
                                </p>
                                <a href={`mailto:${booking.parent.email}`} className="text-base font-bold text-white hover:text-primary transition-colors">
                                    {booking.parent.email}
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Internal Notes Timeline */}
            <div className="glass-card rounded-3xl p-8 !bg-[#1a1c23]/80 !border-[#2a2d35]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Internal Notes</h3>
                </div>

                {student.id ? (
                    <InternalNotesTimeline childId={student.id} initialNotes={initialNotes} />
                ) : (
                    <p className="text-sm text-slate-500 italic">No student associated with this booking to attach notes to.</p>
                )}
            </div>
        </div>
    );
}
