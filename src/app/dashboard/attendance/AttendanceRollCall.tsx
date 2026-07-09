'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2, Edit2 } from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'no_show' | 'excused' | null;

interface Attendee {
    id: string;
    childId: string;
    attendanceStatus: AttendanceStatus;
    attendanceNote: string | null;
    lateMinutes: number | null;
    child: {
        firstName: string;
        lastName: string;
        schoolYear: string;
    };
}

interface BookingRow {
    id: string;
    startAt: Date;
    duration: number;
    status: string;
    parent: {
        firstName: string;
        lastName: string;
    };
    centre: {
        name: string;
    } | null;
    attendees: Attendee[];
}

interface Props {
    bookings: BookingRow[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    present: { label: 'Present', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    absent: { label: 'Absent', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' },
    late: { label: 'Late', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' },
    no_show: { label: 'No Show', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' },
    excused: { label: 'Excused', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20' },
};

function AttendeeCard({ bookingId, attendee }: { bookingId: string; attendee: Attendee }) {
    const [status, setStatus] = useState<AttendanceStatus>(attendee.attendanceStatus);
    const [note, setNote] = useState<string>(attendee.attendanceNote || '');
    const [lateMinutes, setLateMinutes] = useState<string>(
        attendee.lateMinutes !== null && attendee.lateMinutes !== undefined ? attendee.lateMinutes.toString() : ''
    );
    const [showDetails, setShowDetails] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    const mark = (newStatus: AttendanceStatus) => {
        const autoOpen = newStatus === 'late';
        if (autoOpen) setShowDetails(true);

        startTransition(async () => {
            await markAttendeeAttendance({
                bookingId,
                attendeeId: attendee.id,
                status: newStatus,
                note: note || null,
                lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
            });
            setStatus(newStatus);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        });
    };

    const saveDetails = () => {
        startTransition(async () => {
            await markAttendeeAttendance({
                bookingId,
                attendeeId: attendee.id,
                status,
                note: note || null,
                lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        });
    };

    const initials = `${attendee.child.firstName[0]}${attendee.child.lastName[0]}`.toUpperCase();
    const cfg = status ? STATUS_CONFIG[status] : null;

    return (
        <div className="space-y-2">
            <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${cfg
                ? `${cfg.bg} ${cfg.border}`
                : 'bg-[#2a2d35]/50 border-[#424754]/20'
            }`}>
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg ? `${cfg.bg} ${cfg.text}` : 'bg-[#adc6ff]/10 text-[#adc6ff]'}`}>
                    {initials}
                </div>

                {/* Name + year */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-sm truncate">
                            {attendee.child.firstName} {attendee.child.lastName}
                        </p>
                        {(note || lateMinutes) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Has notes/late minutes" />
                        )}
                    </div>
                    <p className="text-[#8c909f] text-xs">
                        Year {attendee.child.schoolYear}
                        {lateMinutes && ` · Late: ${lateMinutes} mins`}
                        {note && ` · "${note}"`}
                    </p>
                </div>

                {/* Status badge */}
                {cfg && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border} hidden sm:inline-flex`}>
                        {cfg.label}
                    </span>
                )}

                {/* Saved flash */}
                {saved && <span className="text-emerald-400 text-xs font-bold animate-pulse">Saved</span>}

                {/* Loading */}
                {isPending && <Loader2 className="w-4 h-4 text-[#8c909f] animate-spin flex-shrink-0" />}

                {/* Quick action buttons */}
                {!isPending && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            title="Add Note/Details"
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${showDetails
                                ? 'bg-[#adc6ff]/20 border-[#adc6ff]/40 text-[#adc6ff]'
                                : 'bg-[#1a1d23] border-[#424754]/30 text-[#8c909f] hover:border-[#adc6ff]/40 hover:text-white'
                            }`}
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => mark(status === 'present' ? null : 'present')}
                            title="Mark Present"
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${status === 'present'
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                : 'bg-[#1a1d23] border-[#424754]/30 text-[#8c909f] hover:border-emerald-500/50 hover:text-emerald-400'
                            }`}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => mark(status === 'late' ? null : 'late')}
                            title="Mark Late"
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${status === 'late'
                                ? 'bg-amber-500 border-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                                : 'bg-[#1a1d23] border-[#424754]/30 text-[#8c909f] hover:border-amber-500/50 hover:text-amber-400'
                            }`}
                        >
                            <Clock className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => mark(status === 'absent' ? null : 'absent')}
                            title="Mark Absent"
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${status === 'absent'
                                ? 'bg-red-500 border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                                : 'bg-[#1a1d23] border-[#424754]/30 text-[#8c909f] hover:border-red-500/50 hover:text-red-400'
                            }`}
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Note and Late Pickup edit form drawer */}
            {showDetails && (
                <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-2xl p-4 ml-6 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1">Attendance Note</label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Reason for late arrival, absence context, medical log..."
                                className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                            />
                        </div>
                        <div className="w-full sm:w-32">
                            <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1">Late Mins</label>
                            <input
                                type="number"
                                value={lateMinutes}
                                onChange={(e) => setLateMinutes(e.target.value)}
                                placeholder="Minutes"
                                min="0"
                                className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setShowDetails(false)}
                            className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-[#424754]/20 text-white/60 hover:text-white text-xs font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveDetails}
                            disabled={isPending}
                            className="px-3.5 py-1.5 rounded-xl bg-[#adc6ff]/10 border border-[#adc6ff]/20 hover:bg-[#adc6ff]/20 text-[#adc6ff] text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                            Save Details
                        </button>
                    </div>
                </div>
            )}
        </div>

    );
}

export default function AttendanceRollCall({ bookings }: Props) {
    return (
        <div className="space-y-6">
            {bookings.map(booking => {
                const allMarked = booking.attendees.length > 0 &&
                    booking.attendees.every(a => a.attendanceStatus !== null);
                const presentCount = booking.attendees.filter(a => a.attendanceStatus === 'present').length;

                return (
                    <div key={booking.id} className="bg-[#1a1d23] rounded-[24px] border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
                        {/* Booking header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#424754]/15 bg-[#1e2230]/50">
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <p className="text-[#adc6ff] font-black text-lg leading-none">
                                        {format(new Date(booking.startAt), 'h:mm')}
                                    </p>
                                    <p className="text-[#8c909f] text-xs font-bold">{format(new Date(booking.startAt), 'a')}</p>
                                </div>
                                <div className="w-px h-8 bg-[#424754]/30" />
                                <div>
                                    <p className="text-white font-semibold text-sm">
                                        {booking.parent.firstName} {booking.parent.lastName}&apos;s session
                                    </p>
                                    <p className="text-[#8c909f] text-xs">
                                        {booking.centre?.name} · {booking.duration} min · {booking.attendees.length} student{booking.attendees.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {allMarked ? (
                                    <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {presentCount}/{booking.attendees.length} marked
                                    </span>
                                )}
                                <Link
                                    href={`/dashboard/bookings/${booking.id}`}
                                    className="text-xs font-bold text-[#adc6ff] hover:text-[#4d8eff] transition-colors"
                                >
                                    Details →
                                </Link>
                            </div>
                        </div>

                        {/* Attendees */}
                        <div className="p-4 space-y-2">
                            {booking.attendees.length === 0 ? (
                                <p className="text-center text-[#8c909f] text-sm py-2 italic">No students linked to this booking</p>
                            ) : (
                                booking.attendees.map(attendee => (
                                    <AttendeeCard
                                        key={attendee.id}
                                        bookingId={booking.id}
                                        attendee={attendee as any}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
