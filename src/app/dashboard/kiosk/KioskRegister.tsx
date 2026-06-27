'use client';

import { useState, useTransition, useEffect } from 'react';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import {
    CheckCircle2, XCircle, Clock, AlertTriangle,
    Loader2, ChevronLeft, ChevronRight, Users,
    Maximize2, RefreshCw, Shield, Stethoscope
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | null;

interface Child {
    id: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    notes: string | null;
    parent: { firstName: string; lastName: string; phone: string | null };
}

interface Attendee {
    id: string;
    childId: string;
    attendanceStatus: AttendanceStatus;
    child: Child;
}

interface Booking {
    id: string;
    startAt: Date;
    duration: number;
    centre: { name: string } | null;
    attendees: Attendee[];
}

interface Centre { id: string; name: string; }

interface Props {
    bookings: Booking[];
    date: string;
    centreName: string;
    centres: Centre[];
    activeCentreId: string;
}

// ── Individual student card ───────────────────────────────────────────────────
function StudentCard({ bookingId, attendee, isLarge }: {
    bookingId: string;
    attendee: Attendee;
    isLarge: boolean;
}) {
    const [status, setStatus] = useState<AttendanceStatus>(attendee.attendanceStatus);
    const [isPending, startTransition] = useTransition();
    const [flash, setFlash] = useState(false);

    const mark = (s: AttendanceStatus) => {
        const next = status === s ? null : s;
        startTransition(async () => {
            await markAttendeeAttendance({ bookingId, attendeeId: attendee.id, status: next });
            setStatus(next);
            setFlash(true);
            setTimeout(() => setFlash(false), 800);
        });
    };

    const hasAlert = !!attendee.child.notes;
    const initials = `${attendee.child.firstName[0]}${attendee.child.lastName[0]}`.toUpperCase();

    const statusStyle = {
        present: { ring: 'ring-2 ring-emerald-500 bg-emerald-500/10', avatar: 'bg-emerald-500 text-white' },
        absent:  { ring: 'ring-2 ring-red-500 bg-red-500/10',     avatar: 'bg-red-500 text-white' },
        late:    { ring: 'ring-2 ring-amber-500 bg-amber-500/10', avatar: 'bg-amber-500 text-white' },
        excused: { ring: 'ring-2 ring-purple-500 bg-purple-500/10', avatar: 'bg-purple-500 text-white' },
    };

    const style = status ? statusStyle[status] : { ring: 'ring-1 ring-white/10 bg-white/5', avatar: 'bg-white/10 text-white/60' };
    const pad = isLarge ? 'p-5' : 'p-4';
    const avatarSize = isLarge ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base';
    const btnSize = isLarge ? 'h-14 text-sm gap-2 px-4' : 'h-11 text-xs gap-1.5 px-3';

    return (
        <div className={`rounded-2xl border transition-all duration-200 ${pad} ${style.ring} ${flash ? 'scale-[0.98]' : ''}`}>
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className={`${avatarSize} rounded-xl flex items-center justify-center font-black flex-shrink-0 transition-colors ${style.avatar}`}>
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className={`font-bold text-white truncate ${isLarge ? 'text-lg' : 'text-base'}`}>
                            {attendee.child.firstName} {attendee.child.lastName}
                        </p>
                        {hasAlert && (
                            <span title={attendee.child.notes!} className="flex-shrink-0">
                                <Stethoscope className="w-4 h-4 text-red-400" />
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">
                        Year {attendee.child.schoolYear} · {attendee.child.parent.firstName} {attendee.child.parent.lastName}
                        {attendee.child.parent.phone && ` · ${attendee.child.parent.phone}`}
                    </p>
                    {hasAlert && (
                        <p className="text-xs text-red-400 mt-1 font-medium truncate">⚠ {attendee.child.notes}</p>
                    )}
                </div>

                {/* Action buttons */}
                {!isPending && (
                    <div className={`flex items-center gap-2 flex-shrink-0 ${isLarge ? 'flex-row' : 'flex-col sm:flex-row'}`}>
                        {([
                            { s: 'present' as const, icon: <CheckCircle2 className="w-4 h-4" />, label: 'In',     active: 'bg-emerald-500 text-white', inactive: 'bg-white/5 text-white/40 hover:text-emerald-400' },
                            { s: 'late'    as const, icon: <Clock className="w-4 h-4" />,        label: 'Late',   active: 'bg-amber-500 text-white',   inactive: 'bg-white/5 text-white/40 hover:text-amber-400'   },
                            { s: 'absent'  as const, icon: <XCircle className="w-4 h-4" />,      label: 'Out',    active: 'bg-red-500 text-white',     inactive: 'bg-white/5 text-white/40 hover:text-red-400'     },
                        ]).map(({ s, icon, label, active, inactive }) => (
                            <button
                                key={s}
                                onClick={() => mark(s)}
                                className={`${btnSize} rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 ${status === s ? active : inactive}`}
                            >
                                {icon} {isLarge && label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Kiosk Register ───────────────────────────────────────────────────────
export default function KioskRegister({ bookings, date, centreName, centres, activeCentreId }: Props) {
    const router = useRouter();
    const [sessionIdx, setSessionIdx] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [clock, setClock] = useState(new Date());
    const [large, setLarge] = useState(true);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Auto-refresh every 60s to pick up new bookings
    useEffect(() => {
        const t = setInterval(() => router.refresh(), 60_000);
        return () => clearInterval(t);
    }, [router]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const allStudents = bookings.flatMap(b => b.attendees.map(a => ({ ...a, bookingId: b.id })));
    const totalCount = allStudents.length;
    const presentCount = allStudents.filter(a => a.attendanceStatus === 'present').length;
    const absentCount = allStudents.filter(a => a.attendanceStatus === 'absent').length;
    const lateCount = allStudents.filter(a => a.attendanceStatus === 'late').length;
    const unmarkedCount = allStudents.filter(a => a.attendanceStatus === null).length;
    const progressPct = totalCount > 0 ? Math.round(((totalCount - unmarkedCount) / totalCount) * 100) : 0;

    // If multiple sessions, show per-session view; otherwise flat list
    const useSessionView = bookings.length > 1;
    const activeBooking = useSessionView ? bookings[sessionIdx] : null;
    const displayAttendees = useSessionView
        ? (activeBooking?.attendees.map(a => ({ ...a, bookingId: activeBooking.id })) ?? [])
        : allStudents;

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0f1117] -mx-4 sm:-mx-6 lg:-mx-8 -my-6 overflow-hidden">

            {/* ── TOP BAR ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#1a1c23] border-b border-white/5 flex-shrink-0">
                {/* Left: date + centre */}
                <div>
                    <h1 className="text-white font-black text-lg leading-tight">Daily Register</h1>
                    <p className="text-white/40 text-xs mt-0.5">{date} · {centreName}</p>
                </div>

                {/* Centre: live clock */}
                <div className="text-white font-black text-3xl tabular-nums tracking-tight">
                    {format(clock, 'HH:mm')}
                    <span className="text-white/20 text-lg ml-1">{format(clock, ':ss')}</span>
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-2">
                    <button onClick={() => router.refresh()} title="Refresh"
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => setLarge(v => !v)} title="Toggle size"
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <Users className="w-4 h-4" />
                    </button>
                    <button onClick={toggleFullscreen} title="Fullscreen"
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    {centres.length > 1 && (
                        <select
                            value={activeCentreId}
                            onChange={e => router.push(`/dashboard/kiosk?centre=${e.target.value}`)}
                            className="bg-white/5 border border-white/10 text-white text-xs font-bold px-3 py-2.5 rounded-xl outline-none"
                        >
                            <option value="all">All Centres</option>
                            {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* ── STATS BAR ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-0 border-b border-white/5 flex-shrink-0">
                {[
                    { label: 'Total', value: totalCount, color: 'text-white' },
                    { label: 'Present', value: presentCount, color: 'text-emerald-400' },
                    { label: 'Late', value: lateCount, color: 'text-amber-400' },
                    { label: 'Absent', value: absentCount, color: 'text-red-400' },
                    { label: 'Unmarked', value: unmarkedCount, color: unmarkedCount > 0 ? 'text-orange-400' : 'text-white/30' },
                ].map((stat, i) => (
                    <div key={stat.label} className={`flex-1 py-3 text-center ${i > 0 ? 'border-l border-white/5' : ''}`}>
                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{stat.label}</p>
                    </div>
                ))}
                {/* Progress */}
                <div className="flex-1 py-3 px-4 border-l border-white/5">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Done</p>
                        <p className="text-xs font-black text-white">{progressPct}%</p>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── SESSION TABS (if multiple bookings) ────────────────────────── */}
            {useSessionView && (
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 overflow-x-auto flex-shrink-0">
                    {bookings.map((b, i) => {
                        const bPresent = b.attendees.filter(a => a.attendanceStatus === 'present').length;
                        const bMarked = b.attendees.filter(a => a.attendanceStatus !== null).length;
                        const bDone = bMarked === b.attendees.length && b.attendees.length > 0;
                        return (
                            <button key={b.id} onClick={() => setSessionIdx(i)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 transition-all ${
                                    i === sessionIdx
                                        ? 'bg-primary text-white'
                                        : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
                                }`}>
                                {bDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                {format(new Date(b.startAt), 'h:mm a')}
                                <span className="text-[11px] opacity-60">{bPresent}/{b.attendees.length}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── STUDENT LIST ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {bookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                        <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-5">
                            <Users className="w-9 h-9 text-white/20" />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">No sessions today</h2>
                        <p className="text-white/40 text-sm max-w-xs">There are no bookings scheduled for today at this centre.</p>
                    </div>
                ) : displayAttendees.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-white/30 text-sm">No students in this session</div>
                ) : (
                    <div className={`grid gap-3 p-6 ${large ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                        {displayAttendees.map(a => (
                            <StudentCard key={a.id} bookingId={a.bookingId} attendee={a as any} isLarge={large} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── BOTTOM NAV (mobile multi-session) ─────────────────────────── */}
            {useSessionView && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-[#1a1c23] flex-shrink-0">
                    <button onClick={() => setSessionIdx(i => Math.max(0, i - 1))} disabled={sessionIdx === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-30 hover:bg-white/10 transition-all">
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <p className="text-white/40 text-sm">Session {sessionIdx + 1} of {bookings.length}</p>
                    <button onClick={() => setSessionIdx(i => Math.min(bookings.length - 1, i + 1))} disabled={sessionIdx === bookings.length - 1}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-30 hover:bg-white/10 transition-all">
                        Next <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
