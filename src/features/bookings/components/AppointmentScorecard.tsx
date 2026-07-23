'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { BookingWithDetails } from '../types';
import { ChevronDown, ChevronUp, MapPin, User, Phone, Mail, Clock, CheckCircle, Video } from '@/components/ui/Icons';
import { cn } from '@/components/ui/utils';
import { updateBookingStatus, rescheduleBooking, saveAssessmentFeedback, sendAssessmentFeedback } from '@/features/bookings/actions';
import { useTransition } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface AppointmentScorecardProps {
    booking: BookingWithDetails;
    defaultExpanded?: boolean;
}

export default function AppointmentScorecard({ booking, defaultExpanded = false }: AppointmentScorecardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [isPending, startTransition] = useTransition();
    const params = useParams();

    useEffect(() => {
        setExpanded(defaultExpanded);
    }, [defaultExpanded]);

    // Reschedule State
    const [showReschedule, setShowReschedule] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleSlots, setRescheduleSlots] = useState<{ startAt: string; available: boolean }[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [rescheduleError, setRescheduleError] = useState('');

    // Assessment Section State
    const [showAssessment, setShowAssessment] = useState(false);

    const toggleExpanded = () => setExpanded(!expanded);

    // Fetch slots when date changes
    useEffect(() => {
        if (!rescheduleDate || !showReschedule) return;

        const fetchSlots = async () => {
            setLoadingSlots(true);
            setRescheduleSlots([]);
            setSelectedSlot(null);
            try {
                // Determine modality and duration from current booking
                const modality = booking.modality;
                const duration = booking.duration;
                const centreId = booking.centre.id;

                const res = await fetch(`/api/availability?centreId=${centreId}&date=${rescheduleDate}&duration=${duration}&modality=${modality}`);
                if (res.ok) {
                    const data = await res.json();
                    setRescheduleSlots(data.slots || []);
                }
            } catch (err) {
                logger.error("Failed to fetch slots", err);
            } finally {
                setLoadingSlots(false);
            }
        };
        fetchSlots();
    }, [rescheduleDate, showReschedule, booking.centre.id, booking.duration, booking.modality]);

    const handleStatusChange = (status: 'completed' | 'cancelled' | 'rescheduled' | 'confirmed') => {
        const newStatus = booking.status === status ? 'confirmed' : status;
        startTransition(async () => {
            try {
                await updateBookingStatus(booking.id, newStatus);
            } catch (error) {
                logger.error('Failed to update status:', error);
                // Optionally add toast here
            }
        });
    };

    const confirmReschedule = () => {
        if (!selectedSlot) return;
        setRescheduleError('');
        startTransition(async () => {
            try {
                await rescheduleBooking(booking.id, selectedSlot);
                setShowReschedule(false);
                setRescheduleDate('');
                setSelectedSlot(null);
            } catch (error) {
                logger.error('Failed to reschedule:', error);
                setRescheduleError('Failed to reschedule. Please try again.');
            }
        });
    };

    const startDate = new Date(booking.startAt);
    const endDate = new Date(startDate.getTime() + booking.duration * 60000);

    const dayName = startDate.toLocaleDateString('en-GB', { weekday: 'short' });
    const dayNum = startDate.getDate();
    const month = startDate.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    const year = startDate.getFullYear();

    const timeRange = `${startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

    // Determine status color
    const statusColor = booking.status === 'confirmed' ? 'text-success' :
        booking.status === 'cancelled' ? 'text-destructive' :
            booking.status === 'completed' ? 'text-primary' : 'text-warning';

    const statusBg = booking.status === 'confirmed' ? 'bg-success/10' :
        booking.status === 'cancelled' ? 'bg-destructive/10' :
            booking.status === 'completed' ? 'bg-primary/10' : 'bg-warning/10';

    return (
        <>
            <div className="bg-card rounded-xl overflow-hidden shadow-lg border border-border hover:border-border transition-all duration-300 relative">
                {/* Header / Summary View */}
                <div
                    className="p-5 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={toggleExpanded}
                >
                    <div className="flex justify-between items-start">
                        {/* Left: Date & Time */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-xl font-bold text-cyan-400 font-mono tracking-wide">
                                    {dayNum} {month} {year}
                                </h3>
                                {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                            </div>

                            <div className="text-muted-foreground text-lg font-medium mb-1">
                                {dayName} {timeRange}
                            </div>

                            {/* Title: Student Names */}
                            <div className="text-foreground text-xl font-semibold mb-2">
                                {booking.attendees.length > 0
                                    ? booking.attendees.map(a => `${a.child.firstName} ${a.child.lastName} (${a.child.schoolYear})`).join(', ')
                                    : booking.child
                                        ? `${booking.child.firstName} ${booking.child.lastName} (${booking.child.schoolYear})`
                                        : 'No student information'
                                }
                            </div>

                            {/* Quick Info Line */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    {booking.modality === 'online' ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                    {booking.modality === 'online' ? 'Online' : booking.centre.name}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    {booking.duration} min
                                </span>
                            </div>
                        </div>

                        {/* Right: Status & Actions */}
                        <div className="text-right flex flex-col items-end gap-2">
                            {/* Status Badge */}
                            <div className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5", statusBg, statusColor)}>
                                <div className={cn("w-2 h-2 rounded-full bg-current")} />
                                {booking.status.replace('_', ' ')}
                            </div>

                            {/* Cost / Type info mimicking the image "Total cost" */}
                            <div className="mt-2">
                                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Session Type</div>
                                <div className="text-foreground font-medium">
                                    {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : booking.assessmentType === 'progress_review' ? 'Progress Check' : 'Activity Session'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Content */}
                {expanded && (
                    <div className="px-5 pb-5 pt-0 border-t border-border bg-muted/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-5">
                            {/* Parent Contact */}
                            <div className="space-y-1">
                                <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Parent Contact</h4>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="w-4 h-4 text-primary" />
                                    <span className="font-medium text-foreground">{booking.parent.firstName} {booking.parent.lastName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <span>{booking.parent.phone || 'No phone'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <span className="truncate max-w-[200px]">{booking.parent.email}</span>
                                </div>
                            </div>

                            {/* Booking Details */}
                            <div className="space-y-1">
                                <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Session Details</h4>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <span className="text-sm font-medium text-muted-foreground">Confirmation:</span>
                                    <code className="bg-secondary px-2 py-0.5 rounded text-primary font-mono text-xs border border-border">
                                        {booking.confirmationCode}
                                    </code>
                                </div>

                                {booking.googleCalendarEventId && (
                                    <div className="flex items-center gap-2 text-success/80 text-xs mt-1">
                                        <CheckCircle className="w-3 h-3" />
                                        <span> synced to calendar</span>
                                    </div>
                                )}

                                {/* Subjects Details */}
                                <div className="mt-3 pt-3 border-t border-border">
                                    <h5 className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Subjects</h5>
                                    <div className="space-y-2">
                                        {booking.attendees.map((attendee) => (
                                            <div key={attendee.child.id} className="flex flex-col gap-1">
                                                {booking.attendees.length > 1 && (
                                                    <div className="text-xs font-semibold text-muted-foreground">
                                                        {attendee.child.firstName}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-1.5 align-middle">
                                                    {attendee.child.subjects && attendee.child.subjects.length > 0 ? (
                                                        attendee.child.subjects.map((s) => (
                                                            <span
                                                                key={s.id}
                                                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-primary border border-border capitalize shadow-sm"
                                                            >
                                                                {s.subject === 'Other' ? (s.customSubject || 'Other') : s.subject.replace(/_/g, ' ')}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No activities listed</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-1">
                                <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Status</h4>
                                <div className="bg-secondary rounded-lg p-3 border border-border">
                                    <div className="text-xs text-muted-foreground mb-1">ATTENDANCE</div>
                                    <div className="flex flex-col gap-2">
                                        <div className={`font-bold text-lg flex items-center gap-2 ${booking.status === 'completed' ? 'text-success' :
                                            booking.status === 'cancelled' ? 'text-destructive' :
                                                'text-primary'
                                            }`}>
                                            {booking.status === 'completed' ? 'Attended' :
                                                booking.status === 'cancelled' ? 'No Show/Cancelled' :
                                                    'Scheduled'}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-4">
                                        Booking-level status · Last updated: {booking.updatedAt ? new Date(booking.updatedAt).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Assessment Section - Collapsible */}
                        <div className="mt-6 pt-6 border-t border-border">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAssessment(!showAssessment);
                                }}
                                className="w-full flex items-center justify-between text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 hover:text-foreground transition-colors"
                            >
                                <span>Feedback & Notes</span>
                                {showAssessment ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {showAssessment && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                                    {booking.attendees.map(attendee => (
                                        <AttendeeAssessment key={attendee.id} attendee={attendee} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                            <button
                                onClick={() => setShowReschedule(true)}
                                disabled={isPending}
                                className="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-colors border border-border"
                            >
                                Reschedule
                            </button>
                            {params?.bookingId !== booking.id && (
                                <Link
                                    href={`/dashboard/bookings/${booking.id}`}
                                    className="px-4 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-all"
                                >
                                    View Full Record
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Reschedule Modal Overlay */}
            {showReschedule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn border border-border">
                        <h3 className="text-xl font-bold text-foreground mb-4">Reschedule Session</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Select New Date</label>
                                <input
                                    type="date"
                                    value={rescheduleDate}
                                    onChange={(e) => setRescheduleDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 border border-border bg-background rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div className="flex gap-3 mt-6 pt-4 border-t border-border">
                                <button
                                    onClick={() => { setShowReschedule(false); }}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmReschedule}
                                    className="flex-1 px-4 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function AttendeeAssessment({ attendee }: { attendee: BookingWithDetails['attendees'][0] }) {
    const [notes, setNotes] = useState(attendee.feedbackNotes || '');
    const [score, setScore] = useState(attendee.feedbackScore || '');
    const [status, setStatus] = useState(attendee.feedbackStatus || 'PENDING');
    const [isSaving, startSaving] = useTransition();
    return null;
}
