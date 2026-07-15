'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { markAttendeeAttendance, registerWalkInChild, registerExistingChildWalkIn } from '@/features/bookings/actions';
import { updateAttendanceTimelog } from '@/features/attendance/actions';
import {
    CheckCircle2, XCircle, AlertCircle, Loader2, Plus, Search, X,
    Users, Sparkles, UserCheck, LogIn, LogOut, ChevronDown, BookOpen, AlertTriangle, BookMarked
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';


type AttendanceStatus = 'present' | 'absent' | 'late' | 'no_show' | 'excused' | null;

interface Attendee {
    id: string;
    childId: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string | null;
    parentEmail: string | null;
    attendanceStatus: AttendanceStatus;
    attendanceNote: string | null;
    lateMinutes: number | null;
    isCatchUp: boolean;
    bookingId: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    sessionType: 'scheduled' | 'extra' | null;
    flagHomework: boolean;
    flagBehaviour: boolean;
    flagNote: string | null;
    notes: string | null;
}

interface CompiledSlot {
    time: string;
    timeLabel: string;
    regulars: Attendee[];
    catchups: Attendee[];
}

interface Props {
    slots: CompiledSlot[];
    centreId: string;
    dateStr: string;
    allStudents?: {
        id: string;
        firstName: string;
        lastName: string;
        schoolYear: string;
        parentId: string;
        parentFirstName: string;
        parentLastName: string;
        parentEmail: string;
        parentPhone: string;
    }[];
}

function nowHHmm(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

function lateMinutesFrom(checkIn: string, slot: string): number | null {
    const [ih, im] = checkIn.split(':').map(Number);
    const [sh, sm] = slot.split(':').map(Number);
    const diff = (ih * 60 + im) - (sh * 60 + sm);
    return diff > 10 ? diff : null;
}

// ─── Absence reason grid ──────────────────────────────────────────────────────
const ABSENCE_REASONS = [
    { key: 'illness',  emoji: '🤒', label: 'Illness' },
    { key: 'holiday',  emoji: '✈️', label: 'Holiday' },
    { key: 'family',   emoji: '👪', label: 'Family'  },
    { key: 'other',    emoji: '📋', label: 'Other'   },
] as const;

// ─── AttendeeCard ─────────────────────────────────────────────────────────────
function AttendeeCard({
    attendee,
    dateStr,
    sessionTime,
    centreId,
    onToast,
    onStatusChange,
}: {
    attendee: Attendee;
    dateStr: string;
    sessionTime: string;
    centreId: string;
    onToast: ReturnType<typeof useToast>['toast'];
    onStatusChange?: (id: string, patch: { checkedIn?: boolean; checkedOut?: boolean; absent?: boolean }) => void;
}) {
    const [curBookingId, setCurBookingId] = useState<string | null>(attendee.bookingId);
    const [curAttendeeId, setCurAttendeeId] = useState<string | null>(attendee.id);

    const [checkIn,  setCheckIn]  = useState<string>(attendee.checkInTime  ?? '');
    const [checkOut, setCheckOut] = useState<string>(attendee.checkOutTime ?? '');
    const [isAbsent, setIsAbsent] = useState(attendee.attendanceStatus === 'absent');
    const [absenceReason, setAbsenceReason] = useState<string>('');
    const [note, setNote] = useState<string>(attendee.attendanceNote ?? '');
    const [showAbsenceSheet, setShowAbsenceSheet] = useState(false);
    const [saved, setSaved]   = useState(false);
    const [isPending, startTransition] = useTransition();

    const derivedLate = checkIn ? lateMinutesFrom(checkIn, sessionTime) : null;
    const isIn  = !!checkIn;
    const isOut = !!checkOut;
    const isExtra = attendee.sessionType === 'extra';

    const ensureBooking = async (): Promise<{ bookingId: string; attendeeId: string }> => {
        if (curBookingId && !curBookingId.startsWith('temp-') && curAttendeeId && !curAttendeeId.startsWith('temp-')) {
            return { bookingId: curBookingId, attendeeId: curAttendeeId };
        }
        const res = await markAttendeeAttendance({
            bookingId: curBookingId, attendeeId: curAttendeeId,
            status: 'present', note: null, lateMinutes: null,
            childId: attendee.childId, dateStr, sessionTime, centreId,
        });
        if (res) {
            setCurBookingId(res.bookingId);
            setCurAttendeeId(res.attendeeId ?? null);
            return { bookingId: res.bookingId, attendeeId: res.attendeeId! };
        }
        throw new Error('Could not create booking record');
    };

    const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

    const handleCheckIn = () => {
        const time = nowHHmm();
        setCheckIn(time);
        setIsAbsent(false);
        setShowAbsenceSheet(false);
        onStatusChange?.(attendee.id, { checkedIn: true, absent: false });
        startTransition(async () => {
            try {
                const { attendeeId } = await ensureBooking();
                await updateAttendanceTimelog({ attendeeId, checkInTime: time, checkOutTime: checkOut || null, absenceReason: null, attendanceNote: note || null, sessionTime });
                flashSaved();
            } catch {
                onToast({ title: 'Could not record check-in', message: 'Please try again.', variant: 'error' });
                setCheckIn('');
                onStatusChange?.(attendee.id, { checkedIn: false });
            }
        });
    };

    const handleCheckOut = () => {
        const time = nowHHmm();
        setCheckOut(time);
        onStatusChange?.(attendee.id, { checkedOut: true });
        startTransition(async () => {
            try {
                const { attendeeId } = await ensureBooking();
                await updateAttendanceTimelog({ attendeeId, checkInTime: checkIn || null, checkOutTime: time, absenceReason: null, attendanceNote: note || null, sessionTime });
                flashSaved();
            } catch {
                onToast({ title: 'Could not record check-out', message: 'Please try again.', variant: 'error' });
                setCheckOut('');
                onStatusChange?.(attendee.id, { checkedOut: false });
            }
        });
    };

    const handleMarkAbsent = (reason: typeof ABSENCE_REASONS[number]['key']) => {
        setIsAbsent(true);
        setAbsenceReason(reason);
        setCheckIn('');
        setCheckOut('');
        setShowAbsenceSheet(false);
        onStatusChange?.(attendee.id, { absent: true, checkedIn: false, checkedOut: false });
        startTransition(async () => {
            try {
                const res = await markAttendeeAttendance({
                    bookingId: curBookingId, attendeeId: curAttendeeId,
                    status: 'absent', note: reason, lateMinutes: null,
                    childId: attendee.childId, dateStr, sessionTime, centreId,
                });
                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId ?? null);
                }
                if (res?.attendeeId) {
                    await updateAttendanceTimelog({ attendeeId: res.attendeeId, checkInTime: null, checkOutTime: null, absenceReason: reason, attendanceNote: null, sessionTime });
                }
                flashSaved();
            } catch {
                onToast({ title: 'Could not mark absent', message: 'Please try again.', variant: 'error' });
                setIsAbsent(false);
                onStatusChange?.(attendee.id, { absent: false });
            }
        });
    };

    const initials = `${attendee.firstName[0]}${attendee.lastName[0]}`.toUpperCase();

    // ── Status-driven visual tokens ──────────────────────────────────────────
    // Left border bar + card background
    const cardClass = isAbsent
        ? 'border-l-4 border-l-red-400 bg-red-50 border border-red-200 border-l-red-400'
        : (isIn && isOut)
        ? 'border-l-4 border-l-blue-500 bg-blue-50 border border-blue-200'
        : isIn
        ? 'border-l-4 border-l-emerald-500 bg-emerald-50 border border-emerald-200'
        : 'border-l-4 border-l-gray-200 bg-white border border-gray-200';

    const avatarClass = isAbsent
        ? 'bg-red-200 text-red-700'
        : (isIn && isOut)
        ? 'bg-blue-200 text-blue-700'
        : isIn
        ? 'bg-emerald-200 text-emerald-800'
        : 'bg-gray-100 text-gray-600';

    return (
        <div className={`rounded-2xl transition-all ${cardClass}`}>
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-13 h-13 rounded-2xl flex items-center justify-center text-base font-black flex-shrink-0 select-none ${avatarClass}`}
                         style={{ width: 52, height: 52 }}>
                        {initials}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                        {/* Name row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link
                                href={`/dashboard/students/${attendee.childId}`}
                                className="font-bold text-gray-900 text-base hover:text-blue-600 transition-colors leading-tight"
                            >
                                {attendee.firstName} {attendee.lastName}
                            </Link>
                            {isExtra && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                    <Sparkles className="w-2.5 h-2.5" /> EXTRA
                                </span>
                            )}
                            {attendee.flagHomework && (
                                <span title={attendee.flagNote || 'Not bringing homework'} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
                                    <BookOpen className="w-2.5 h-2.5" /> HW
                                </span>
                            )}
                            {attendee.flagBehaviour && (
                                <span title={attendee.flagNote || 'Behaviour concern'} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                    <AlertTriangle className="w-2.5 h-2.5" /> BEHAVIOUR
                                </span>
                            )}
                            {derivedLate !== null && isIn && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                    Late {derivedLate}m
                                </span>
                            )}
                        </div>

                        {/* Sub info */}
                        <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                            Year {attendee.schoolYear} · {attendee.parentFirstName} {attendee.parentLastName}
                            {attendee.parentPhone && ` · ${attendee.parentPhone}`}
                        </p>

                        {/* Status indicators */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap min-h-[20px]">
                            {saved && <span className="text-xs font-bold text-emerald-600 animate-pulse">Saved ✓</span>}
                            {isPending && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                            {isIn && (
                                <span className="text-xs font-semibold text-emerald-700">In {checkIn}{isOut ? ` → Out ${checkOut}` : ''}</span>
                            )}
                            {isAbsent && (
                                <span className="text-xs font-semibold text-red-600">
                                    Absent{absenceReason ? ` — ${absenceReason}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Action buttons ─────────────────────────────────────── */}
                {isAbsent ? (
                    /* Absent state — show undo */
                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-100 border border-red-200">
                            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            <span className="text-sm font-bold text-red-700">
                                Absent{absenceReason ? ` — ${absenceReason}` : ''}
                            </span>
                        </div>
                        <button
                            onClick={() => { setIsAbsent(false); setAbsenceReason(''); }}
                            className="px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            Undo
                        </button>
                    </div>
                ) : (
                    <div className="mt-3 space-y-2">
                        {/* Primary action row */}
                        <div className="flex items-center gap-2">
                            {/* CHECK IN */}
                            <button
                                onClick={handleCheckIn}
                                disabled={isPending}
                                className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                                    isIn
                                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                        : 'bg-white border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800'
                                }`}
                            >
                                <LogIn className="w-4 h-4 flex-shrink-0" />
                                {isIn ? `In ${checkIn}` : 'Check In'}
                            </button>

                            {/* CHECK OUT — only after check-in */}
                            {isIn && (
                                <button
                                    onClick={handleCheckOut}
                                    disabled={isPending}
                                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                                        isOut
                                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800'
                                    }`}
                                >
                                    <LogOut className="w-4 h-4 flex-shrink-0" />
                                    {isOut ? `Out ${checkOut}` : 'Check Out'}
                                </button>
                            )}

                            {/* MARK ABSENT — only when not checked in */}
                            {!isIn && (
                                <button
                                    onClick={() => setShowAbsenceSheet(v => !v)}
                                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                                        showAbsenceSheet
                                            ? 'bg-red-100 border-red-300 text-red-800'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                                    }`}
                                >
                                    <XCircle className="w-4 h-4 flex-shrink-0" />
                                    Mark Absent
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAbsenceSheet ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                        </div>

                        {/* Time edit row — compact, below main actions */}
                        {(isIn || isOut) && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                {isIn && (
                                    <label className="flex items-center gap-1.5">
                                        <span className="font-medium">In:</span>
                                        <input
                                            type="time"
                                            value={checkIn}
                                            onChange={e => setCheckIn(e.target.value)}
                                            className="h-9 px-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
                                        />
                                    </label>
                                )}
                                {isIn && isOut && (
                                    <label className="flex items-center gap-1.5">
                                        <span className="font-medium">Out:</span>
                                        <input
                                            type="time"
                                            value={checkOut}
                                            onChange={e => setCheckOut(e.target.value)}
                                            className="h-9 px-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
                                        />
                                    </label>
                                )}
                            </div>
                        )}

                        {/* ── Absence reason sheet ─────────────────────── */}
                        {showAbsenceSheet && (
                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 animate-in slide-in-from-top-1 duration-150">
                                {ABSENCE_REASONS.map(r => (
                                    <button
                                        key={r.key}
                                        onClick={() => handleMarkAbsent(r.key)}
                                        disabled={isPending}
                                        className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-white border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        <span className="text-2xl leading-none">{r.emoji}</span>
                                        <span className="text-sm font-bold text-gray-700">{r.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Slot progress bar ────────────────────────────────────────────────────────
function SlotProgressBar({ marked, total }: { marked: number; total: number }) {
    const pct = total > 0 ? Math.round((marked / total) * 100) : 0;
    return (
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ─── Live status tracker ──────────────────────────────────────────────────────
type AttendeeStatus = { checkedIn: boolean; checkedOut: boolean; absent: boolean };

export default function AttendanceRollCall({ slots, centreId, dateStr, allStudents = [] }: Props) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [markedStatus, setMarkedStatus] = useState<Record<string, AttendeeStatus>>(() => {
        const map: Record<string, AttendeeStatus> = {};
        for (const slot of slots) {
            for (const a of [...slot.regulars, ...slot.catchups]) {
                map[a.id] = {
                    checkedIn: !!a.checkInTime,
                    checkedOut: !!a.checkOutTime,
                    absent: a.attendanceStatus === 'absent',
                };
            }
        }
        return map;
    });

    const updateMarkedStatus = (id: string, patch: Partial<AttendeeStatus>) => {
        setMarkedStatus(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const [walkInTab, setWalkInTab] = useState<'existing' | 'new'>('existing');
    const [selectedChildId, setSelectedChildId] = useState('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [formChildFirst, setFormChildFirst] = useState('');
    const [formChildLast, setFormChildLast] = useState('');
    const [formYear, setFormYear] = useState('Reception');
    const [formSessionTime, setFormSessionTime] = useState('15:45');
    const [formParentFirst, setFormParentFirst] = useState('');
    const [formParentLast, setFormParentLast] = useState('');
    const [formParentEmail, setFormParentEmail] = useState('');
    const [formParentPhone, setFormParentPhone] = useState('');

    const handleWalkInSubmit = async () => {
        setIsSubmitting(true);
        try {
            if (walkInTab === 'existing') {
                if (!selectedChildId) {
                    toast({ title: 'No student selected', message: 'Please select a student from the list first.', variant: 'warning' });
                    setIsSubmitting(false);
                    return;
                }
                await registerExistingChildWalkIn({ centreId, dateStr, childId: selectedChildId, sessionTime: formSessionTime });
                const childObj = allStudents.find(s => s.id === selectedChildId);
                toast({ title: `${childObj?.firstName || 'Student'} added successfully`, message: "They have been added to today's session.", variant: 'success' });
            } else {
                if (!formChildFirst || !formChildLast || !formParentFirst || !formParentLast || !formParentEmail) {
                    toast({ title: 'Missing information', message: 'Please fill in all required fields before submitting.', variant: 'warning' });
                    setIsSubmitting(false);
                    return;
                }
                await registerWalkInChild({
                    centreId, dateStr,
                    childFirstName: formChildFirst, childLastName: formChildLast, schoolYear: formYear,
                    parentFirstName: formParentFirst, parentLastName: formParentLast,
                    parentEmail: formParentEmail, parentPhone: formParentPhone || undefined,
                    sessionTime: formSessionTime,
                });
                toast({ title: `${formChildFirst} registered successfully`, message: "They have been added to today's session.", variant: 'success' });
            }
            setFormChildFirst(''); setFormChildLast('');
            setFormParentFirst(''); setFormParentLast('');
            setFormParentEmail(''); setFormParentPhone('');
            setSelectedChildId(''); setStudentSearchQuery('');
            setShowWalkIn(false);
        } catch {
            toast({ title: 'Could not register student', message: 'Please check the details and try again.', variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredSlots = slots
        .map(slot => {
            const search = searchQuery.toLowerCase().trim();
            if (!search) return slot;
            const match = (a: Attendee) => {
                const cn = `${a.firstName} ${a.lastName}`.toLowerCase();
                const pn = `${a.parentFirstName} ${a.parentLastName}`.toLowerCase();
                return cn.includes(search) || pn.includes(search);
            };
            return { ...slot, regulars: slot.regulars.filter(match), catchups: slot.catchups.filter(match) };
        })
        .filter(slot => slot.regulars.length > 0 || slot.catchups.length > 0);

    // ── shared form input style ───────────────────────────────────────────────
    const formInput = 'w-full h-11 px-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors';
    const formLabel = 'block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5';

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ── Sticky action bar ─────────────────────────────────────────── */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-white/95 backdrop-blur-xl border-b border-gray-200 flex flex-col sm:flex-row items-stretch gap-2.5">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search students or parents…"
                        className="w-full h-12 pl-10 pr-10 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowWalkIn(true)}
                        className="flex-1 sm:flex-none h-12 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-200 active:scale-95"
                    >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        Walk-In
                    </button>
                    <Link
                        href="/dashboard/attendance/ledger"
                        className="flex-1 sm:flex-none h-12 px-5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-bold transition-all flex items-center justify-center gap-2 hover:bg-gray-50 shadow-sm active:scale-95"
                    >
                        <BookMarked className="w-4 h-4" />
                        Ledger
                    </Link>
                </div>
            </div>

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {filteredSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                        <Users className="w-7 h-7 text-gray-300" />
                    </div>
                    <h3 className="text-gray-900 font-bold text-base mb-2">No students found</h3>
                    <p className="text-gray-400 text-sm max-w-xs px-4">
                        {searchQuery
                            ? 'No scheduled students match your search.'
                            : "No bookings compiled for today. Tap 'Walk-In' to add one."}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200 transition-all"
                        >
                            Clear search
                        </button>
                    )}
                </div>
            ) : (
                filteredSlots.map(slot => {
                    const allAttendees = [...slot.regulars, ...slot.catchups];
                    const totalCount   = allAttendees.length;
                    const markedCount  = allAttendees.filter(a => {
                        const s = markedStatus[a.id];
                        return s ? (s.checkedIn || s.absent) : (!!a.checkInTime || a.attendanceStatus === 'absent');
                    }).length;
                    const allMarked  = markedCount === totalCount && totalCount > 0;
                    const missingOut = allAttendees.filter(a => {
                        const s = markedStatus[a.id];
                        return s ? (s.checkedIn && !s.checkedOut && !s.absent) : (!!a.checkInTime && !a.checkOutTime);
                    }).length;

                    return (
                        <div
                            key={slot.time}
                            className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
                        >
                            {/* Slot header */}
                            <div className="px-6 pt-5 pb-3 border-b border-gray-100 bg-gray-50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-blue-600 font-black text-xl leading-none">
                                                {slot.timeLabel.split(' ')[0]}
                                            </p>
                                            <p className="text-gray-400 text-xs font-bold">
                                                {slot.timeLabel.split(' ')[1]}
                                            </p>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200" />
                                        <div>
                                            <p className="text-gray-900 font-bold text-sm">
                                                Session — {slot.timeLabel}
                                            </p>
                                            <p className="text-gray-400 text-xs">
                                                {totalCount} student{totalCount !== 1 ? 's' : ''} expected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        {missingOut > 0 && (
                                            <span className="flex items-center gap-1.5 text-orange-600 text-xs font-bold px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {missingOut} no check-out
                                            </span>
                                        )}
                                        {allMarked ? (
                                            <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {markedCount}/{totalCount} marked
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <SlotProgressBar marked={markedCount} total={totalCount} />
                            </div>

                            {/* Two-column grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                                {/* Regular register */}
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                                            Regular Register
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
                                            {slot.regulars.length} scheduled
                                        </span>
                                    </div>

                                    {slot.regulars.length === 0 ? (
                                        <p className="text-center text-gray-300 text-xs py-8 italic border-2 border-dashed border-gray-100 rounded-2xl">
                                            No regular students scheduled for this slot.
                                        </p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {slot.regulars.map(child => (
                                                <AttendeeCard
                                                    key={child.id}
                                                    attendee={child}
                                                    dateStr={dateStr}
                                                    sessionTime={slot.time}
                                                    centreId={centreId}
                                                    onToast={toast}
                                                    onStatusChange={updateMarkedStatus}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Catch-ups / Walk-ins */}
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                            <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-wider">
                                                Catch-Ups & Walk-Ins
                                            </h4>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
                                            {slot.catchups.length} guest{slot.catchups.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {slot.catchups.length === 0 ? (
                                        <p className="text-center text-gray-300 text-xs py-8 italic border-2 border-dashed border-gray-100 rounded-2xl">
                                            No catch-ups or walk-ins registered.
                                        </p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {slot.catchups.map(child => (
                                                <AttendeeCard
                                                    key={child.id}
                                                    attendee={child}
                                                    dateStr={dateStr}
                                                    sessionTime={slot.time}
                                                    centreId={centreId}
                                                    onToast={toast}
                                                    onStatusChange={updateMarkedStatus}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}

            {/* ── Walk-In Modal ─────────────────────────────────────────────── */}
            {showWalkIn && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Register Walk-In</h3>
                                <p className="text-sm text-gray-400">Add a child for a one-off session</p>
                            </div>
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {centreId !== 'all' && (
                            <div className="flex border-b border-gray-100 bg-gray-50">
                                {(['existing', 'new'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setWalkInTab(tab)}
                                        className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-all ${
                                            walkInTab === tab
                                                ? 'border-blue-600 text-blue-600 bg-white'
                                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        {tab === 'existing' ? 'Existing Student' : 'New Guest'}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            {centreId === 'all' ? (
                                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">
                                    ⚠ Please select a specific centre from the sidebar before registering a walk-in.
                                </div>
                            ) : (
                                <>
                                    {walkInTab === 'existing' ? (
                                        <>
                                            <div>
                                                <label className={formLabel}>Search Students</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={studentSearchQuery}
                                                        onChange={e => setStudentSearchQuery(e.target.value)}
                                                        placeholder="Search by name…"
                                                        className={`${formInput} pl-9`}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={formLabel}>Select Student *</label>
                                                {(() => {
                                                    const booked = new Set(slots.flatMap(s => [...s.regulars, ...s.catchups].map(a => a.childId)));
                                                    const available = allStudents.filter(s =>
                                                        !booked.has(s.id) &&
                                                        (`${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                                                         `${s.parentFirstName} ${s.parentLastName}`.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                                                    );
                                                    return (
                                                        <div className="max-h-44 overflow-y-auto space-y-1.5">
                                                            {available.length === 0 ? (
                                                                <p className="text-sm text-gray-400 py-6 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                                                                    No available students found.
                                                                </p>
                                                            ) : available.map(student => (
                                                                <button
                                                                    key={student.id}
                                                                    type="button"
                                                                    onClick={() => setSelectedChildId(student.id)}
                                                                    className={`w-full text-left p-3.5 rounded-xl border text-sm flex justify-between items-center transition-all ${
                                                                        selectedChildId === student.id
                                                                            ? 'bg-blue-50 border-blue-400 text-gray-900 font-bold'
                                                                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                                                    }`}
                                                                >
                                                                    <div>
                                                                        <div>{student.firstName} {student.lastName} <span className="text-gray-400 font-normal">(Yr {student.schoolYear})</span></div>
                                                                        <div className="text-xs text-gray-400 font-normal mt-0.5">
                                                                            {student.parentFirstName} {student.parentLastName}
                                                                        </div>
                                                                    </div>
                                                                    {selectedChildId === student.id && <UserCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div>
                                                <label className={formLabel}>Session Time</label>
                                                <select value={formSessionTime} onChange={e => setFormSessionTime(e.target.value)} className={formInput}>
                                                    {['15:45', '17:00', '11:00', '12:15', '13:30', '14:45'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={formLabel}>Child First Name *</label>
                                                    <input type="text" required value={formChildFirst} onChange={e => setFormChildFirst(e.target.value)} placeholder="e.g. John" className={formInput} />
                                                </div>
                                                <div>
                                                    <label className={formLabel}>Child Last Name *</label>
                                                    <input type="text" required value={formChildLast} onChange={e => setFormChildLast(e.target.value)} placeholder="e.g. Doe" className={formInput} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={formLabel}>School Year</label>
                                                    <select value={formYear} onChange={e => setFormYear(e.target.value)} className={formInput}>
                                                        {['Nursery', 'Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(yr => (
                                                            <option key={yr} value={yr}>Year {yr}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={formLabel}>Session Time</label>
                                                    <select value={formSessionTime} onChange={e => setFormSessionTime(e.target.value)} className={formInput}>
                                                        {['15:45', '17:00', '11:00', '12:15', '13:30', '14:45'].map(t => (
                                                            <option key={t} value={t}>{t}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={formLabel}>Parent First Name *</label>
                                                    <input type="text" required value={formParentFirst} onChange={e => setFormParentFirst(e.target.value)} placeholder="e.g. Mary" className={formInput} />
                                                </div>
                                                <div>
                                                    <label className={formLabel}>Parent Last Name *</label>
                                                    <input type="text" required value={formParentLast} onChange={e => setFormParentLast(e.target.value)} placeholder="e.g. Doe" className={formInput} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={formLabel}>Parent Email *</label>
                                                    <input type="email" required value={formParentEmail} onChange={e => setFormParentEmail(e.target.value)} placeholder="mary@example.com" className={formInput} />
                                                </div>
                                                <div>
                                                    <label className={formLabel}>Parent Phone</label>
                                                    <input type="tel" value={formParentPhone} onChange={e => setFormParentPhone(e.target.value)} placeholder="07123456789" className={formInput} />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="h-11 px-5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            {centreId !== 'all' && (
                                <button
                                    onClick={handleWalkInSubmit}
                                    disabled={isSubmitting}
                                    className="h-11 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-sm shadow-emerald-200 active:scale-95"
                                >
                                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {walkInTab === 'existing' ? 'Add to Register' : 'Register & Check In'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
