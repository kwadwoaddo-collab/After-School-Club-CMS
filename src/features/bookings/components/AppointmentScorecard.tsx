'use client';

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
                console.error("Failed to fetch slots", err);
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
                console.error('Failed to update status:', error);
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
                console.error('Failed to reschedule:', error);
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
    const statusColor = booking.status === 'confirmed' ? 'text-green-400' :
        booking.status === 'cancelled' ? 'text-red-400' :
            booking.status === 'completed' ? 'text-blue-400' : 'text-yellow-400';

    const statusBg = booking.status === 'confirmed' ? 'bg-green-500/10' :
        booking.status === 'cancelled' ? 'bg-red-500/10' :
            booking.status === 'completed' ? 'bg-blue-500/10' : 'bg-yellow-500/10';

    return (
        <>
            <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700/50 hover:border-slate-600 transition-all duration-300 relative">
                {/* Header / Summary View */}
                <div
                    className="p-5 cursor-pointer hover:bg-slate-800/50 transition-colors"
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
                            </div>

                            <div className="text-slate-300 text-lg font-medium mb-1">
                                {dayName} {timeRange}
                            </div>

                            {/* Title: Student Names */}
                            {/* Title: Student Names */}
                            <div className="text-white text-xl font-semibold mb-2">
                                {booking.attendees.length > 0
                                    ? booking.attendees.map(a => `${a.child.firstName} ${a.child.lastName} (${a.child.schoolYear})`).join(', ')
                                    : booking.child
                                        ? `${booking.child.firstName} ${booking.child.lastName} (${booking.child.schoolYear})`
                                        : 'No student information'
                                }
                            </div>

                            {/* Quick Info Line */}
                            <div className="flex items-center gap-4 text-sm text-slate-400">
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
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5">Session Type</div>
                                <div className="text-white font-medium">
                                    {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : booking.assessmentType === 'progress_review' ? 'Progress Check' : 'Activity Session'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Content */}
                {expanded && (
                    <div className="px-5 pb-5 pt-0 border-t border-slate-700/50 bg-slate-800/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-5">
                            {/* Parent Contact */}
                            <div className="space-y-1">
                                <h4 className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Parent Contact</h4>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <User className="w-4 h-4 text-indigo-400" />
                                    <span className="font-medium text-white">{booking.parent.firstName} {booking.parent.lastName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Phone className="w-4 h-4 text-slate-500" />
                                    <span>{booking.parent.phone || 'No phone'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Mail className="w-4 h-4 text-slate-500" />
                                    <span className="truncate max-w-[200px]">{booking.parent.email}</span>
                                </div>
                            </div>

                            {/* Booking Details */}
                            <div className="space-y-1">
                                <h4 className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Session Details</h4>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <span className="text-sm font-medium text-slate-400">Confirmation:</span>
                                    <code className="bg-slate-900 px-2 py-0.5 rounded text-indigo-300 font-mono text-xs border border-indigo-900/50">
                                        {booking.confirmationCode}
                                    </code>
                                </div>

                                {booking.googleCalendarEventId && (
                                    <div className="flex items-center gap-2 text-green-400/80 text-xs mt-1">
                                        <CheckCircle className="w-3 h-3" />
                                        <span> synced to calendar</span>
                                    </div>
                                )}

                                {/* Subjects Details */}
                                <div className="mt-3 pt-3 border-t border-slate-700/50">
                                    <h5 className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Subjects</h5>
                                    <div className="space-y-2">
                                        {booking.attendees.map((attendee) => (
                                            <div key={attendee.child.id} className="flex flex-col gap-1">
                                                {booking.attendees.length > 1 && (
                                                    <div className="text-xs font-semibold text-slate-400">
                                                        {attendee.child.firstName}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-1.5 align-middle">
                                                    {attendee.child.subjects && attendee.child.subjects.length > 0 ? (
                                                        attendee.child.subjects.map((s) => (
                                                            <span
                                                                key={s.id}
                                                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-700/50 text-indigo-300 border border-slate-600/50 capitalize shadow-sm"
                                                            >
                                                                {s.subject === 'Other' ? (s.customSubject || 'Other') : s.subject.replace(/_/g, ' ')}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-500 italic">No activities listed</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Parent Notes/Comments from Booking */}
                                {booking.attendees.some(a => a.child.notes) && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Parent Notes</span>
                                        <div className="text-slate-300 text-xs italic">
                                            {booking.attendees.map((a, i) => (
                                                a.child.notes && (
                                                    <div key={a.id} className="mb-1">
                                                        {booking.attendees.length > 1 && <span className="font-semibold not-italic text-slate-400 mr-1">{a.child.firstName}:</span>}
                                                        "{a.child.notes}"
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Statistics / Other (mimicking "Smart Charging Savings") */}
                            <div className="space-y-1">
                                <h4 className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Status</h4>
                                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                    <div className="text-xs text-slate-400 mb-1">ATTENDANCE</div>

                                    <div className="flex flex-col gap-2">
                                        <div className={`font-bold text-lg flex items-center gap-2 ${booking.status === 'completed' ? 'text-green-400' :
                                            booking.status === 'cancelled' ? 'text-red-400' :
                                                'text-blue-400'
                                            }`}>
                                            {booking.status === 'completed' ? 'Attended' :
                                                booking.status === 'cancelled' ? 'No Show/Cancelled' :
                                                    'Scheduled'}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <button
                                                onClick={() => handleStatusChange('completed')}
                                                disabled={isPending}
                                                className={`text-xs px-2 py-1.5 rounded border transition-colors ${booking.status === 'completed'
                                                    ? 'bg-green-900/40 border-green-500/50 text-green-300 hover:bg-green-900/60'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                                    } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {isPending && booking.status !== 'completed' ? 'Updating...' : 'Mark Attended'}
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('cancelled')}
                                                disabled={isPending}
                                                className={`text-xs px-2 py-1.5 rounded border transition-colors ${booking.status === 'cancelled'
                                                    ? 'bg-red-900/40 border-red-500/50 text-red-300 hover:bg-red-900/60'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                                    } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {isPending && booking.status !== 'cancelled' ? 'Updating...' : 'No Show'}
                                            </button>
                                        </div>
                                    </div>

                                    {booking.attendees.length > 1 && (
                                        <div className="text-[10px] text-amber-400/80 mt-2 flex items-center gap-1">
                                            <span>⚠</span>
                                            <span>Applies to all {booking.attendees.length} children in this booking</span>
                                        </div>
                                    )}
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        Booking-level status · Last updated: {booking.updatedAt ? new Date(booking.updatedAt).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Assessment Section - Collapsible */}
                        <div className="mt-6 pt-6 border-t border-slate-700/50">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAssessment(!showAssessment);
                                }}
                                className="w-full flex items-center justify-between text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 hover:text-slate-400 transition-colors"
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
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/50">
                            {booking.status !== 'cancelled' && (
                                <button
                                    onClick={() => handleStatusChange('cancelled')}
                                    disabled={isPending}
                                    className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50"
                                >
                                    {isPending ? 'Cancelling...' : 'Cancel Booking'}
                                </button>
                            )}
                            <button
                                onClick={() => setShowReschedule(true)}
                                disabled={isPending}
                                className="px-4 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30 rounded-lg transition-colors border border-indigo-900/50 hover:border-indigo-700/50"
                            >
                                Reschedule
                            </button>
                            {params?.bookingId !== booking.id && (
                                <Link
                                    href={`/dashboard/bookings/${booking.id}`}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-900/20 transition-all hover:translate-y-[-1px] inline-flex items-center justify-center transform active:scale-95"
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
                    <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
                        <h3 className="text-xl font-bold text-foreground mb-4">Reschedule Session</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Select New Date</label>
                                <input
                                    type="date"
                                    value={rescheduleDate}
                                    onChange={(e) => setRescheduleDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {rescheduleDate && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">Available Times</label>
                                    {loadingSlots ? (
                                        <div className="flex justify-center py-4 text-muted-foreground">
                                            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Loading...
                                        </div>
                                    ) : rescheduleSlots.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-2">No slots available for this date.</p>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                            {rescheduleSlots.map((slot) => {
                                                const time = new Date(slot.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                                                const isSelected = selectedSlot === slot.startAt;
                                                return (
                                                    <button
                                                        key={slot.startAt}
                                                        onClick={() => setSelectedSlot(slot.startAt)}
                                                        disabled={!slot.available}
                                                        className={`py-2 px-1 text-xs rounded border transition-colors ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' :
                                                            !slot.available ? 'bg-secondary/60 text-muted-foreground cursor-not-allowed' :
                                                                'bg-card text-foreground border-border hover:border-indigo-300'
                                                            }`}
                                                    >
                                                        {time}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {rescheduleError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                                    {rescheduleError}
                                </div>
                            )}

                            <div className="flex gap-3 mt-6 pt-4 border-t border-border">
                                <button
                                    onClick={() => { setShowReschedule(false); setRescheduleDate(''); setSelectedSlot(null); }}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-foreground bg-secondary/60 hover:bg-secondary rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmReschedule}
                                    disabled={!selectedSlot || isPending}
                                    className="flex-1 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPending ? 'Confirming...' : 'Confirm Change'}
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
    const [fileBase64, setFileBase64] = useState<string | null>(attendee.feedbackAttachmentBase64 || null);
    const [mimeType, setMimeType] = useState<string | null>(attendee.feedbackAttachmentMime || null);
    const [isSaving, startSaving] = useTransition();
    const [isSending, startSending] = useTransition();
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [sendConfirm, setSendConfirm] = useState(false);

    // Update local state when prop updates (e.g. after revalidation)
    useEffect(() => {
        setNotes(attendee.feedbackNotes || '');
        setScore(attendee.feedbackScore || '');
        setStatus(attendee.feedbackStatus || 'PENDING');
        setFileBase64(attendee.feedbackAttachmentBase64 || null);
        setMimeType(attendee.feedbackAttachmentMime || null);
    }, [attendee]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB
            setUploadError('File size must be less than 2MB');
            return;
        }

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            setUploadError('Only JPG/PNG images allowed');
            return;
        }

        setUploadError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setFileBase64(base64);
            setMimeType(file.type);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        startSaving(async () => {
            await saveAssessmentFeedback(attendee.id, {
                notes,
                score,
                base64: fileBase64 || undefined,
                mime: mimeType || undefined
            });
            // Status update is handled via revalidation usually, but optimistic update helps
            if (status !== 'SENT') setStatus('DRAFT');
        });
    };

    const handleSend = () => {
        startSending(async () => {
            // Save first to ensure server has latest data before marking sent
            await saveAssessmentFeedback(attendee.id, {
                notes,
                score,
                base64: fileBase64 || undefined,
                mime: mimeType || undefined
            });
            await sendAssessmentFeedback(attendee.id);
            setStatus('SENT');
            setSendConfirm(false);
        });
    };

    // Status colors
    const statusColor = status === 'SENT' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
        status === 'DRAFT' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
            'bg-slate-700/50 text-slate-400 border-slate-600/50';

    return (
        <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50 mt-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h5 className="font-semibold text-white text-sm">{attendee.child.firstName}'s Session Feedback</h5>
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", statusColor)}>
                        {status}
                    </span>
                </div>
                {status === 'SENT' && attendee.feedbackSentAt && (
                    <span className="text-xs text-slate-500">
                        Sent {new Date(attendee.feedbackSentAt).toLocaleDateString('en-GB')}
                    </span>
                )}
            </div>

            <div className="space-y-4">
                {/* Score Input */}
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Score (Optional)</label>
                    <input
                        type="text"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        placeholder="e.g. 8/10 or A"
                        disabled={status === 'SENT'}
                        className="w-full bg-slate-800 border-slate-700 text-white rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 placeholder:text-slate-600"
                    />
                </div>

                {/* Notes Input */}
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Club Leader Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        disabled={status === 'SENT'}
                        placeholder="Enter feedback for the parent..."
                        className="w-full bg-slate-800 border-slate-700 text-white rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 placeholder:text-slate-600"
                    />
                </div>

                {/* File Upload */}
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Session Activity / Worksheet (Photo)</label>

                    {fileBase64 ? (
                        <div className="relative group inline-block">
                            <img src={fileBase64} alt="Session Activity" className="w-full max-w-[200px] h-32 object-cover rounded-md border border-slate-700" />
                            {status !== 'SENT' && (
                                <button
                                    onClick={() => { setFileBase64(null); setMimeType(null); }}
                                    className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                                    title="Remove image"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    ) : (
                        status !== 'SENT' && (
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-700 border-dashed rounded-md hover:border-indigo-500/50 transition-colors group cursor-pointer relative">
                                <div className="space-y-1 text-center">
                                    <svg className="mx-auto h-8 w-8 text-slate-400 group-hover:text-indigo-400 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="flex text-sm text-slate-400 justify-center">
                                        <span className="relative cursor-pointer rounded-md font-medium text-indigo-400 hover:text-indigo-300 focus-within:outline-none">
                                            <span>Upload a file</span>
                                            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} accept="image/png, image/jpeg" />
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">PNG, JPG up to 2MB</p>
                                </div>
                            </div>
                        )
                    )}
                    {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
                </div>

                {/* Actions */}
                {status !== 'SENT' && (
                    <div className="flex items-center gap-2 justify-end pt-2 border-t border-slate-700/50 mt-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isSending}
                            className="px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 hover:bg-indigo-900/30 rounded border border-indigo-900/50 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving…' : 'Save Draft'}
                        </button>

                        {sendConfirm ? (
                            <>
                                <span className="text-xs text-slate-400">Send to parent?</span>
                                <button
                                    onClick={() => setSendConfirm(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded border border-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={isSaving || isSending}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded shadow-sm transition-all disabled:opacity-50"
                                >
                                    {isSending ? 'Sending…' : 'Yes, Send'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setSendConfirm(true)}
                                disabled={isSaving || isSending || (!notes && !fileBase64)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded shadow-sm shadow-indigo-900/20 transition-all disabled:opacity-50"
                            >
                                Send to Parent
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
