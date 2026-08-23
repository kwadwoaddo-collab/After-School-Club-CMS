/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock, MapPin, User, Mail, Phone, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import MarkAttendedButton from '@/features/bookings/components/MarkAttendedButton';
import InternalNotesTimeline from '@/features/students/components/InternalNotesTimeline';
import { getStudentNotes } from '@/features/students/notes.actions';
import { getUserAccessibleCentres, getUserAccessibleCentreIds } from '@/lib/permissions';
import ReassignCentreButton from '@/features/bookings/components/ReassignCentreButton';
import { isFeatureEnabled } from '@/lib/feature-flags';
import AttendanceDropdown from './AttendanceDropdown';
import type { AttendanceStatus } from '@/lib/attendance';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const STATUS_LABELS: Record<string, string> = {
    confirmed: 'Booked',
    signed_up: 'Signed-up',
    completed: 'Attended',
    pending: 'Pending',
    cancelled: 'Cancelled',
    rescheduled: 'Rescheduled',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    confirmed: 'info',
    signed_up: 'success',
    completed: 'success',
    pending: 'warning',
    cancelled: 'default',
    rescheduled: 'default',
};

interface BookingPageProps {
    params: Promise<{ bookingId: string }>;
}

export default async function BookingDetailPage({ params }: BookingPageProps) {
    const { bookingId } = await params;
    const session = await auth();
    if (!session?.user?.organisationId) redirect('/login');

    if (bookingId === 'new') return notFound();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) return notFound();

    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
            parent: true,
            centre: true,
            attendees: {
                with: {
                    child: {
                        with: { notes: { orderBy: (notes, { desc }) => [desc(notes.createdAt)] } }
                    }
                }
            },
            staff: true
        }
    });

    if (!booking) return notFound();
    if (!booking.centre || booking.centre.organisationId !== session.user.organisationId) return notFound();

    // Centre membership check for non-ORG_OWNER users — matches the check
    // already enforced by the mutation APIs acting on this same record
    // (cancel/reschedule/status/PATCH .../centre) and by the List page's
    // query scoping (which only ever fetches bookings from the viewer's
    // accessible centres). This detail page previously had no equivalent
    // check, so a staff member could view another centre's booking (child
    // name/DOB, parent phone/email, notes) by navigating directly to its URL.
    const userRole = (session.user as any).role as string | undefined;
    if (userRole !== 'ORG_OWNER' && booking.centreId) {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(booking.centreId)) return notFound();
    }

    const orgCentres = await getUserAccessibleCentres(session.user.id);

    const getStudentInfo = () => {
        if (booking.attendees && booking.attendees.length > 0) {
            const child = booking.attendees[0].child;
            return { id: child.id, name: `${child.firstName} ${child.lastName}`, grade: child.schoolYear, dob: child.dateOfBirth, initials: `${(child.firstName || '')[0] || ''}${(child.lastName || '')[0] || ''}`.toUpperCase() || '?' };
        }
        return { id: '', name: 'Unknown Student', grade: null, dob: null, initials: '?' };
    };

    const student = getStudentInfo();
    const initialNotes = student.id ? await getStudentNotes(student.id) : [];

    // Booking lifecycle timeline steps
    const timelineSteps = [
        {
            label: 'Created',
            date: booking.createdAt ? format(new Date(booking.createdAt), 'MMM d, yyyy') : null,
            done: true,
            icon: CheckCircle2,
            colour: 'text-success',
        },
        {
            label: 'Confirmed',
            date: booking.status !== 'pending' && booking.createdAt ? format(new Date(booking.createdAt), 'MMM d, yyyy') : null,
            done: !['pending', 'cancelled'].includes(booking.status),
            icon: booking.status === 'cancelled' ? XCircle : CheckCircle2,
            colour: booking.status === 'cancelled' ? 'text-text-muted' : 'text-accent',
        },
        {
            label: booking.status === 'cancelled' ? 'Cancelled' : booking.status === 'rescheduled' ? 'Rescheduled' : 'Attended',
            date: booking.startAt ? format(new Date(booking.startAt), 'MMM d, yyyy') : null,
            done: ['completed', 'cancelled', 'rescheduled'].includes(booking.status),
            icon: booking.status === 'cancelled' ? XCircle : booking.status === 'rescheduled' ? RefreshCw : CheckCircle2,
            colour: booking.status === 'completed' ? 'text-accent' : booking.status === 'cancelled' ? 'text-text-muted' : booking.status === 'rescheduled' ? 'text-accent' : 'text-text-muted',
        },
    ];

    // Map link for centre address
    const mapLink = booking.centre?.address
        ? `https://maps.google.com/?q=${encodeURIComponent(booking.centre.address)}`
        : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <Link href="/dashboard/bookings" className="p-2 rounded-sm text-text-muted hover:text-text hover:bg-page transition-colors flex-shrink-0">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-page-title text-text">Booking Details</h1>
                        <p className="text-text-secondary text-small-body mt-0.5">View and manage booking</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/bookings/${bookingId}/reschedule`}>
                            Reschedule
                        </Link>
                    </Button>
                    <MarkAttendedButton bookingId={bookingId} initialStatus={booking.status} />
                </div>
            </div>

            {/* Booking Lifecycle Timeline */}
            <Card className="p-6">
                <h3 className="text-label text-text-muted mb-4">Booking Lifecycle</h3>
                <div className="flex items-center gap-0">
                    {timelineSteps.map((step, i) => (
                        <div key={step.label} className="flex items-center flex-1">
                            <div className="flex flex-col items-center gap-1.5 flex-1">
                                <step.icon className={`w-5 h-5 ${step.done ? step.colour : 'text-text-muted'}`} />
                                <p className={`text-xs font-semibold ${step.done ? 'text-text' : 'text-text-muted'}`}>{step.label}</p>
                                {step.date && step.done && <p className="text-[10px] text-text-muted">{step.date}</p>}
                            </div>
                            {i < timelineSteps.length - 1 && (
                                <div className={`h-px flex-1 mx-2 ${step.done ? 'bg-border' : 'bg-border-subtle'}`} />
                            )}
                        </div>
                    ))}
                </div>
            </Card>

            {/* Attendees List */}
            <div className="space-y-4">
                {booking.attendees && booking.attendees.length > 0 ? (
                    booking.attendees.map(attendee => {
                        const child = attendee.child;
                        const initials = `${(child.firstName || '')[0] || ''}${(child.lastName || '')[0] || ''}`.toUpperCase() || '??';
                        return (
                            <Card key={attendee.id} className="p-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent text-lg font-semibold">
                                            {initials}
                                        </div>
                                        <div>
                                            <h2 className="text-section-title text-text mb-1.5">
                                                <Link href={`/dashboard/students/${child.id}`} className="hover:text-accent hover:underline underline-offset-4 transition-colors">
                                                    {child.firstName} {child.lastName}
                                                </Link>
                                            </h2>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <Badge>{child.schoolYear || 'Grade N/A'}</Badge>
                                                {child.dateOfBirth && <span className="text-small-body text-text-secondary">Born: {format(new Date(child.dateOfBirth), 'MMM d, yyyy')}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-3 min-w-[250px]">
                                        <Badge variant={STATUS_VARIANTS[booking.status] || 'default'} className={booking.status === 'cancelled' ? 'opacity-70' : ''}>
                                            {STATUS_LABELS[booking.status] ?? booking.status}
                                        </Badge>
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border-subtle">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft"><Calendar className="w-5 h-5 text-accent" /></div>
                                        <div>
                                            <p className="text-label text-text-muted mb-1">Session Date</p>
                                            <p className="text-small-body font-medium text-text">{booking.startAt ? format(new Date(booking.startAt), 'EEE, MMM d, yyyy') : 'Date TBD'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft"><Clock className="w-5 h-5 text-accent" /></div>
                                        <div>
                                            <p className="text-label text-text-muted mb-1">Time Slot</p>
                                            <p className="text-small-body font-medium text-text">{booking.startAt ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft"><MapPin className="w-5 h-5 text-accent" /></div>
                                        <div>
                                            <p className="text-label text-text-muted mb-1">Location</p>
                                            <div className="flex items-center gap-1">
                                                <p className="text-small-body font-medium text-text">{booking.centre?.name || 'Unknown Location'}</p>
                                                <ReassignCentreButton bookingId={booking.id} currentCentreId={booking.centreId || ''} centres={orgCentres} />
                                            </div>
                                            {mapLink && (
                                                <a href={mapLink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline mt-1 inline-block">
                                                    View on map →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })
                ) : (
                    <Card className="p-8 text-center text-text-muted text-small-body">
                        No attendees found for this booking.
                    </Card>
                )}
            </div>

            {/* Parent Information */}
            <Card className="p-6">
                <h3 className="text-section-title text-text mb-5">Parent Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-page border border-border-subtle"><User className="w-5 h-5 text-text-muted" /></div>
                        <div>
                            <p className="text-label text-text-muted mb-1">Parent Name</p>
                            <Link href={`/dashboard/parents/${booking.parent.id}`} className="text-small-body font-semibold text-text hover:text-accent hover:underline underline-offset-4 transition-colors">
                                {booking.parent.firstName} {booking.parent.lastName}
                            </Link>
                            <p className="text-xs text-accent font-medium mt-0.5">Primary Point of Contact</p>
                        </div>
                    </div>

                    {booking.parent.phone && (
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-page border border-border-subtle"><Phone className="w-5 h-5 text-text-muted" /></div>
                            <div>
                                <p className="text-label text-text-muted mb-1">Phone</p>
                                <a href={`tel:${booking.parent.phone}`} className="text-small-body font-semibold text-text hover:text-accent transition-colors">
                                    {booking.parent.phone}
                                </a>
                            </div>
                        </div>
                    )}

                    {booking.parent.email && (
                        <div className="flex items-center gap-3 md:col-span-2">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-page border border-border-subtle"><Mail className="w-5 h-5 text-text-muted" /></div>
                            <div>
                                <p className="text-label text-text-muted mb-1">Email</p>
                                <a href={`mailto:${booking.parent.email}`} className="text-small-body font-semibold text-text hover:text-accent transition-colors">
                                    {booking.parent.email}
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {booking.staff && (
                <Card className="p-6">
                    <h3 className="text-section-title text-text mb-5">Assigned Staff</h3>
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-page border border-border-subtle"><User className="w-5 h-5 text-text-muted" /></div>
                        <div>
                            <p className="text-label text-text-muted mb-1">Staff Member</p>
                            <Link href={`/dashboard/staff/${booking.staff.id}`} className="text-small-body font-semibold text-text hover:text-accent hover:underline underline-offset-4 transition-colors">
                                {booking.staff.firstName || booking.staff.name} {booking.staff.lastName}
                            </Link>
                        </div>
                    </div>
                </Card>
            )}

            {/* Internal Notes Timeline */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-section-title text-text">Internal Notes</h3>
                </div>
                {student.id ? (
                    <InternalNotesTimeline childId={student.id} initialNotes={initialNotes} />
                ) : (
                    <p className="text-small-body text-text-muted italic">No student associated with this booking to attach notes to.</p>
                )}
            </Card>
        </div>
    );
}
