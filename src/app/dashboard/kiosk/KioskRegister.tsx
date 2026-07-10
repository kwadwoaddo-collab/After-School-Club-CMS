'use client';

import { useState, useTransition, useEffect } from 'react';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import {
    CheckCircle2, XCircle, Clock, AlertTriangle,
    Loader2, ChevronLeft, ChevronRight, Users,
    Maximize2, RefreshCw, Stethoscope, Edit2, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | null;

interface Attendee {
    id: string;
    childId: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    notes?: string | null;
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string | null;
    parentEmail?: string | null;
    attendanceStatus: AttendanceStatus;
    attendanceNote: string | null;
    lateMinutes: number | null;
    isCatchUp: boolean;
    bookingId: string | null;
}

interface CompiledSlot {
    time: string;
    timeLabel: string;
    regulars: Attendee[];
    catchups: Attendee[];
}

interface Centre { id: string; name: string; }

interface Props {
    slots: CompiledSlot[];
    date: string;
    dateStr?: string;
    centreName: string;
    centres: Centre[];
    activeCentreId: string;
}

// ── Individual student card ───────────────────────────────────────────────────
function StudentCard({
    attendee,
    dateStr,
    sessionTime,
    centreId,
    isLarge,
    onToast,
}: {
    attendee: Attendee;
    dateStr: string;
    sessionTime: string;
    centreId: string;
    isLarge: boolean;
    onToast: ReturnType<typeof useToast>['toast'];
}) {
    const [curBookingId, setCurBookingId] = useState<string | null>(attendee.bookingId);
    const [curAttendeeId, setCurAttendeeId] = useState<string>(attendee.id);
    const [status, setStatus] = useState<AttendanceStatus>(attendee.attendanceStatus);
    const [note, setNote] = useState<string>(attendee.attendanceNote || '');
    const [lateMinutes, setLateMinutes] = useState<string>(
        attendee.lateMinutes != null ? attendee.lateMinutes.toString() : ''
    );
    const [showDetails, setShowDetails] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [flash, setFlash] = useState(false);

    const mark = (s: AttendanceStatus) => {
        const next = status === s ? null : s;
        if (next === 'late') setShowDetails(true);

        startTransition(async () => {
            try {
                const res = await markAttendeeAttendance({
                    bookingId: curBookingId,
                    attendeeId: curAttendeeId,
                    status: next,
                    note: note || null,
                    lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
                    childId: attendee.childId,
                    dateStr,
                    sessionTime,
                    centreId,
                });
                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId || attendee.id);
                }
                setStatus(next);
                setFlash(true);
                setTimeout(() => setFlash(false), 800);
            } catch (err: any) {
                onToast({ title: 'Could not mark attendance', message: 'Please try again or refresh.', variant: 'error' });
            }
        });
    };

    const saveDetails = () => {
        startTransition(async () => {
            try {
                const res = await markAttendeeAttendance({
                    bookingId: curBookingId,
                    attendeeId: curAttendeeId,
                    status,
                    note: note || null,
                    lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
                    childId: attendee.childId,
                    dateStr,
                    sessionTime,
                    centreId,
                });
                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId || attendee.id);
                }
                setFlash(true);
                setTimeout(() => setFlash(false), 800);
            } catch (err: any) {
                onToast({ title: 'Could not save details', message: 'Please try again.', variant: 'error' });
            }
        });
    };

    const hasAlert = !!attendee.notes;
    const initials = `${attendee.firstName[0]}${attendee.lastName[0]}`.toUpperCase();

    const statusStyle = {
        present: { ring: 'ring-2 ring-emerald-500 bg-emerald-500/10', avatar: 'bg-emerald-500 text-white' },
        absent:  { ring: 'ring-2 ring-red-500 bg-red-500/10',         avatar: 'bg-red-500 text-white' },
        late:    { ring: 'ring-2 ring-amber-500 bg-amber-500/10',     avatar: 'bg-amber-500 text-white' },
        excused: { ring: 'ring-2 ring-purple-500 bg-purple-500/10',   avatar: 'bg-purple-500 text-white' },
    };

    const style = status ? statusStyle[status] : { ring: 'ring-1 ring-white/10 bg-white/5', avatar: 'bg-white/10 text-white/60' };
    const pad = isLarge ? 'p-5' : 'p-4';
    const avatarSize = isLarge ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base';
    const btnSize = isLarge ? 'h-14 text-sm gap-2 px-4' : 'h-11 text-xs gap-1.5 px-3';

    return (
        <div className="space-y-2">
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
                                {attendee.firstName} {attendee.lastName}
                            </p>
                            {attendee.isCatchUp && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                                    <Sparkles className="w-2.5 h-2.5" /> Catch-Up
                                </span>
                            )}
                            {hasAlert && (
                                <span title={attendee.notes!} className="flex-shrink-0">
                                    <Stethoscope className="w-4 h-4 text-red-400" />
                                </span>
                            )}
                            {(note || lateMinutes) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Has notes/late minutes" />
                            )}
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                            Year {attendee.schoolYear} · {attendee.parentFirstName} {attendee.parentLastName}
                            {attendee.parentPhone && ` · ${attendee.parentPhone}`}
                            {lateMinutes && ` · Late: ${lateMinutes}m`}
                            {note && ` · "${note}"`}
                        </p>
                        {hasAlert && (
                            <p className="text-xs text-red-400 mt-1 font-medium truncate">⚠ {attendee.notes}</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    {!isPending && (
                        <div className={`flex items-center gap-2 flex-shrink-0 ${isLarge ? 'flex-row' : 'flex-col sm:flex-row'}`}>
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                title="Add Notes/Details"
                                className={`${btnSize} rounded-xl font-bold flex items-center justify-center transition-all border ${showDetails
                                    ? 'bg-[#adc6ff]/20 border-[#adc6ff]/40 text-[#adc6ff]'
                                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                                }`}
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            {([
                                { s: 'present' as const, icon: <CheckCircle2 className="w-4 h-4" />, label: 'In',   active: 'bg-emerald-500 text-white', inactive: 'bg-white/5 text-white/40 hover:text-emerald-400' },
                                { s: 'late'    as const, icon: <Clock className="w-4 h-4" />,        label: 'Late', active: 'bg-amber-500 text-white',   inactive: 'bg-white/5 text-white/40 hover:text-amber-400'   },
                                { s: 'absent'  as const, icon: <XCircle className="w-4 h-4" />,      label: 'Out',  active: 'bg-red-500 text-white',     inactive: 'bg-white/5 text-white/40 hover:text-red-400'     },
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

            {/* Note & Late Minutes Drawer */}
            {showDetails && (
                <div className="bg-[#14161b] border border-white/10 rounded-2xl p-4 ml-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">Attendance Note</label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add custom notes..."
                                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                            />
                        </div>
                        <div className="w-full sm:w-28">
                            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">Late Mins</label>
                            <input
                                type="number"
                                value={lateMinutes}
                                onChange={(e) => setLateMinutes(e.target.value)}
                                placeholder="Minutes"
                                min="0"
                                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setShowDetails(false)}
                            className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs font-bold transition-all"
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

// ── Main Kiosk Register ───────────────────────────────────────────────────────
export default function KioskRegister({ slots, date, dateStr, centreName, centres, activeCentreId }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [slotIdx, setSlotIdx] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [clock, setClock] = useState(() => new Date());
    const [large, setLarge] = useState(true);

    // Derive a dateStr from date prop if not passed separately
    const resolvedDateStr = dateStr || new Date().toISOString().slice(0, 10);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Auto-refresh every 60s
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

    // Aggregate stats across all slots
    const allAttendees = slots.flatMap(s => [...s.regulars, ...s.catchups]);
    const totalCount   = allAttendees.length;
    const presentCount = allAttendees.filter(a => a.attendanceStatus === 'present').length;
    const absentCount  = allAttendees.filter(a => a.attendanceStatus === 'absent').length;
    const lateCount    = allAttendees.filter(a => a.attendanceStatus === 'late').length;
    const unmarkedCount = allAttendees.filter(a => a.attendanceStatus === null).length;
    const progressPct  = totalCount > 0 ? Math.round(((totalCount - unmarkedCount) / totalCount) * 100) : 0;

    const activeSlot = slots.length > 0 ? slots[Math.min(slotIdx, slots.length - 1)] : null;
    const displayAttendees = activeSlot
        ? [...activeSlot.regulars, ...activeSlot.catchups]
        : [];

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0f1117] -mx-4 sm:-mx-6 lg:-mx-8 -my-6 overflow-hidden">

            {/* ── TOP BAR ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#1a1c23] border-b border-white/5 flex-shrink-0">
                <div>
                    <h1 className="text-white font-black text-lg leading-tight">Daily Register</h1>
                    <p className="text-white/40 text-xs mt-0.5">{date} · {centreName}</p>
                </div>

                <div className="text-white font-black text-3xl tabular-nums tracking-tight">
                    {format(clock, 'HH:mm')}
                    <span className="text-white/20 text-lg ml-1">{format(clock, ':ss')}</span>
                </div>

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

            {/* ── STATS BAR ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-0 border-b border-white/5 flex-shrink-0">
                {[
                    { label: 'Total',    value: totalCount,    color: 'text-white' },
                    { label: 'Present',  value: presentCount,  color: 'text-emerald-400' },
                    { label: 'Late',     value: lateCount,     color: 'text-amber-400' },
                    { label: 'Absent',   value: absentCount,   color: 'text-red-400' },
                    { label: 'Unmarked', value: unmarkedCount, color: unmarkedCount > 0 ? 'text-orange-400' : 'text-white/30' },
                ].map((stat, i) => (
                    <div key={stat.label} className={`flex-1 py-3 text-center ${i > 0 ? 'border-l border-white/5' : ''}`}>
                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{stat.label}</p>
                    </div>
                ))}
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

            {/* ── SESSION SLOT TABS ──────────────────────────────────────── */}
            {slots.length > 0 && (
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 overflow-x-auto flex-shrink-0">
                    {slots.map((slot, i) => {
                        const slotAll = [...slot.regulars, ...slot.catchups];
                        const slotPresent = slotAll.filter(a => a.attendanceStatus === 'present').length;
                        const slotDone = slotAll.length > 0 && slotAll.every(a => a.attendanceStatus !== null);
                        return (
                            <button key={slot.time} onClick={() => setSlotIdx(i)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 transition-all ${
                                    i === slotIdx
                                        ? 'bg-[#adc6ff] text-slate-950'
                                        : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
                                }`}>
                                {slotDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                {slot.timeLabel}
                                <span className="text-[11px] opacity-60">{slotPresent}/{slotAll.length}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── STUDENT LIST ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {slots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                        <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-5">
                            <Users className="w-9 h-9 text-white/20" />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">No sessions today</h2>
                        <p className="text-white/40 text-sm max-w-xs">
                            No children are permanently scheduled for today. Use Attendance to add a catch-up.
                        </p>
                    </div>
                ) : displayAttendees.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-white/30 text-sm">No students in this slot</div>
                ) : (
                    <div className={`grid gap-3 p-6 ${large ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                        {displayAttendees.map(a => (
                            <StudentCard
                                key={a.id}
                                attendee={a}
                                dateStr={resolvedDateStr}
                                sessionTime={activeSlot!.time}
                                centreId={activeCentreId}
                                isLarge={large}
                                onToast={toast}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── BOTTOM NAV ───────────────────────────────────────────── */}
            {slots.length > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-[#1a1c23] flex-shrink-0">
                    <button onClick={() => setSlotIdx(i => Math.max(0, i - 1))} disabled={slotIdx === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-30 hover:bg-white/10 transition-all">
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <p className="text-white/40 text-sm">Slot {slotIdx + 1} of {slots.length}</p>
                    <button onClick={() => setSlotIdx(i => Math.min(slots.length - 1, i + 1))} disabled={slotIdx === slots.length - 1}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-30 hover:bg-white/10 transition-all">
                        Next <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
