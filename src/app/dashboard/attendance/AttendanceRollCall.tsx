'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
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

    const [checkIn,  setCheckIn]  = useOptimistic<string, string>(attendee.checkInTime  ?? '', (state, update) => update);
    const [checkOut, setCheckOut] = useOptimistic<string, string>(attendee.checkOutTime ?? '', (state, update) => update);
    const [isAbsent, setIsAbsent] = useOptimistic<boolean, boolean>(attendee.attendanceStatus === 'absent', (state, update) => update);
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
        setShowAbsenceSheet(false);
        onStatusChange?.(attendee.id, { checkedIn: true, absent: false });
        startTransition(async () => {
            setCheckIn(time);
            setIsAbsent(false);
            try {
                const { attendeeId } = await ensureBooking();
                await updateAttendanceTimelog({ attendeeId, checkInTime: time, checkOutTime: checkOut || null, dateStr, absenceReason: null, attendanceNote: note || null, sessionTime });
                flashSaved();
            } catch {
                onToast({ title: 'Could not record check-in', message: 'Please try again.', variant: 'error' });
                onStatusChange?.(attendee.id, { checkedIn: false });
            }
        });
    };

    const handleCheckOut = () => {
        const time = nowHHmm();
        onStatusChange?.(attendee.id, { checkedOut: true });
        startTransition(async () => {
            setCheckOut(time);
            try {
                const { attendeeId } = await ensureBooking();
                await updateAttendanceTimelog({ attendeeId, checkInTime: checkIn || null, checkOutTime: time, dateStr, absenceReason: null, attendanceNote: note || null, sessionTime });
                flashSaved();
            } catch {
                onToast({ title: 'Could not record check-out', message: 'Please try again.', variant: 'error' });
                onStatusChange?.(attendee.id, { checkedOut: false });
            }
        });
    };

    const handleMarkAbsent = (reason: typeof ABSENCE_REASONS[number]['key']) => {
        setAbsenceReason(reason);
        setShowAbsenceSheet(false);
        onStatusChange?.(attendee.id, { absent: true, checkedIn: false, checkedOut: false });
        startTransition(async () => {
            setIsAbsent(true);
            setCheckIn('');
            setCheckOut('');
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
                    await updateAttendanceTimelog({ attendeeId: res.attendeeId, checkInTime: null, checkOutTime: null, dateStr, absenceReason: reason, attendanceNote: null, sessionTime });
                }
                flashSaved();
            } catch {
                onToast({ title: 'Could not mark absent', message: 'Please try again.', variant: 'error' });
                onStatusChange?.(attendee.id, { absent: false });
            }
        });
    };

    const initials = `${(attendee.firstName || '')[0] || ''}${(attendee.lastName || '')[0] || ''}`.toUpperCase() || '??';

    // ── Status-driven visual tokens ──────────────────────────────────────────
    // Left border bar + card background
    const cardClass = isAbsent
        ? 'border-l-4 border-l-error bg-error-container/10 border border-error/20'
        : (isIn && isOut)
        ? 'border-l-4 border-l-primary bg-primary/8 border border-primary/20'
        : isIn
        ? 'border-l-4 border-l-tertiary bg-tertiary-container/10 border border-tertiary/20'
        : 'border-l-4 border-l-border bg-card border border-border hover:border-primary/40';

    const avatarClass = isAbsent
        ? 'bg-error-container/20 text-error'
        : (isIn && isOut)
        ? 'bg-primary/20 text-primary'
        : isIn
        ? 'bg-tertiary-container/20 text-tertiary'
        : 'bg-secondary/60 text-muted-foreground';

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
                                className="font-bold text-foreground text-base hover:text-primary transition-colors leading-tight"
                            >
                                {attendee.firstName} {attendee.lastName}
                            </Link>
                            {isExtra && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">
                                    <Sparkles className="w-2.5 h-2.5" /> EXTRA
                                </span>
                            )}
                            {attendee.flagHomework && (
                                <span title={attendee.flagNote || 'Not bringing homework'} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">
                                    <BookOpen className="w-2.5 h-2.5" /> HW
                                </span>
                            )}
                            {attendee.flagBehaviour && (
                                <span title={attendee.flagNote || 'Behaviour concern'} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-error-container/15 text-error border border-error/20">
                                    <AlertTriangle className="w-2.5 h-2.5" /> BEHAVIOUR
                                </span>
                            )}
                            {derivedLate !== null && isIn && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/25">
                                    Late {derivedLate}m
                                </span>
                            )}
                        </div>

                        {/* Sub info */}
                        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                            Year {attendee.schoolYear} · {attendee.parentFirstName} {attendee.parentLastName}
                            {attendee.parentPhone && ` · ${attendee.parentPhone}`}
                        </p>

                        {/* Status indicators */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap min-h-[20px]">
                            {saved && <span className="text-xs font-bold text-success animate-pulse">Saved ✓</span>}
                            {isPending && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                            {isIn && (
                                <span className="text-xs font-semibold text-success">In {checkIn}{isOut ? ` → Out ${checkOut}` : ''}</span>
                            )}
                            {isAbsent && (
                                <span className="text-xs font-semibold text-error">
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
                        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container/15 border border-error/20">
                            <XCircle className="w-4 h-4 text-error flex-shrink-0" />
                            <span className="text-sm font-bold text-error">
                                Absent{absenceReason ? ` — ${absenceReason}` : ''}
                            </span>
                        </div>
                        <button
                            onClick={() => { setIsAbsent(false); setAbsenceReason(''); }}
                            className="px-4 py-3 rounded-xl bg-card border border-border text-sm font-bold text-muted-foreground hover:bg-secondary/40 active:scale-95 duration-100 transition-all"
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
                                className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 duration-100 border ${
                                    isIn
                                        ? 'bg-tertiary-container/15 border-tertiary/30 text-tertiary'
                                        : 'bg-card border-border text-foreground hover:bg-tertiary-container/10 hover:border-tertiary/20 hover:text-tertiary'
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
                                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 duration-100 border ${
                                        isOut
                                            ? 'bg-primary/15 border-primary/30 text-primary'
                                            : 'bg-card border-border text-foreground hover:bg-primary/8 hover:border-primary/25 hover:text-primary'
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
                                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 duration-100 border ${
                                        showAbsenceSheet
                                            ? 'bg-error-container/15 border-error/30 text-error'
                                            : 'bg-card border-border text-foreground hover:bg-error-container/10 hover:border-error/30 hover:text-error'
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
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {isIn && (
                                    <label className="flex items-center gap-1.5">
                                        <span className="font-medium">In:</span>
                                        <input
                                            type="time"
                                            value={checkIn}
                                            onChange={e => setCheckIn(e.target.value)}
                                            className="h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
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
                                            className="h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                                        />
                                    </label>
                                )}
                            </div>
                        )}

                        {/* ── Absence reason sheet ─────────────────────── */}
                        {showAbsenceSheet && (
                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border animate-in slide-in-from-top-1 duration-150">
                                {ABSENCE_REASONS.map(r => (
                                    <button
                                        key={r.key}
                                        onClick={() => handleMarkAbsent(r.key)}
                                        disabled={isPending}
                                        aria-label={r.label}
                                        className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-card border-2 border-border hover:border-error/30 hover:bg-error-container/10 active:scale-95 duration-100 transition-all disabled:opacity-50"
                                    >
                                        <span className="text-2xl leading-none">{r.emoji}</span>
                                        <span className="text-sm font-bold text-foreground">{r.label}</span>
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
        <div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-success' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ─── Live status tracker ──────────────────────────────────────────────────────
type AttendeeStatus = { checkedIn: boolean; checkedOut: boolean; absent: boolean };

export default function AttendanceRollCall({ slots, centreId, dateStr, allStudents = [] }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bulkPendingSlot, setBulkPendingSlot] = useState<string | null>(null);

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

    const handleMarkAllIn = async (slot: CompiledSlot) => {
        const allAttendees = [...slot.regulars, ...slot.catchups];
        const unmarked = allAttendees.filter(a => {
            const s = markedStatus[a.id];
            return s ? (!s.checkedIn && !s.absent) : (!a.checkInTime && a.attendanceStatus !== 'absent');
        });
        if (unmarked.length === 0) {
            toast({ title: 'All students already marked', message: 'No unmarked students in this slot.', variant: 'warning' });
            return;
        }
        setBulkPendingSlot(slot.time);
        try {
            await Promise.all(
                unmarked.map(async (a) => {
                    try {
                        await markAttendeeAttendance({
                            bookingId: a.bookingId, attendeeId: a.id,
                            status: 'present', note: null, lateMinutes: null,
                            childId: a.childId, dateStr, sessionTime: slot.time, centreId,
                        });
                        updateMarkedStatus(a.id, { checkedIn: true, absent: false });
                    } catch { /* individual failure — continue */ }
                })
            );
            toast({
                title: `${unmarked.length} student${unmarked.length > 1 ? 's' : ''} marked In`,
                message: `All unmarked students in the ${slot.timeLabel} slot have been checked in.`,
                variant: 'success',
            });
        } catch {
            toast({ title: 'Bulk mark failed', message: 'Some students could not be marked. Refresh and retry.', variant: 'error' });
        } finally {
            setBulkPendingSlot(null);
        }
    };

    const [walkInTab, setWalkInTab] = useState<'existing' | 'new'>('existing');
    const [selectedChildId, setSelectedChildId] = useState('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [formChildFirst, setFormChildFirst] = useState('');
    const [formChildLast, setFormChildLast] = useState('');
    const [formChildDob, setFormChildDob] = useState('');
    const [formYear, setFormYear] = useState('Reception');
    const [formSessionTime, setFormSessionTime] = useState(() => {
        if (slots.length === 0) return '15:45';
        const now = nowHHmm();
        return slots.reduce((closest, s) => {
            const diff = (t: string) => Math.abs(parseInt(t.replace(':', ''), 10) - parseInt(now.replace(':', ''), 10));
            return diff(s.time) < diff(closest) ? s.time : closest;
        }, slots[0].time);
    });
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
                if (!formChildFirst || !formChildLast || !formParentFirst || !formParentLast || !formParentEmail || !formChildDob) {
                    toast({ title: 'Missing information', message: 'Please fill in all required fields (including Child DOB) before submitting.', variant: 'warning' });
                    setIsSubmitting(false);
                    return;
                }
                await registerWalkInChild({
                    centreId, dateStr,
                    childFirstName: formChildFirst, childLastName: formChildLast, schoolYear: formYear,
                    dateOfBirth: formChildDob,
                    parentFirstName: formParentFirst, parentLastName: formParentLast,
                    parentEmail: formParentEmail, parentPhone: formParentPhone || undefined,
                    sessionTime: formSessionTime,
                });
                toast({ title: `${formChildFirst} registered successfully`, message: "They have been added to today's session.", variant: 'success' });
            }
            setFormChildFirst(''); setFormChildLast(''); setFormChildDob('');
            setFormParentFirst(''); setFormParentLast('');
            setFormParentEmail(''); setFormParentPhone('');
            setSelectedChildId(''); setStudentSearchQuery('');

            setShowWalkIn(false);
            router.refresh();
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
    const formInput = 'w-full h-11 px-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors';
    const formLabel = 'block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5';

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ── Sticky action bar ─────────────────────────────────────────── */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-card/95 backdrop-blur-xl border-b border-border flex flex-col sm:flex-row items-stretch gap-2.5">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search students or parents…"
                        className="w-full h-12 pl-10 pr-10 rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowWalkIn(true)}
                        className="flex-1 sm:flex-none h-12 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/20 active:scale-95 duration-100"
                    >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        Walk-In
                    </button>
                    <Link
                        href="/dashboard/attendance/ledger"
                        className="flex-1 sm:flex-none h-12 px-5 rounded-xl bg-card border border-border text-foreground text-sm font-bold transition-all flex items-center justify-center gap-2 hover:bg-secondary/40 shadow-sm active:scale-95"
                    >
                        <BookMarked className="w-4 h-4" />
                        Ledger
                    </Link>
                </div>
            </div>

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {filteredSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-3xl border-2 border-dashed border-border">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                        <Users className="w-7 h-7 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-foreground font-bold text-base mb-2">No students found</h3>
                    <p className="text-muted-foreground text-sm max-w-xs px-4">
                        {searchQuery
                            ? 'No scheduled students match your search.'
                            : "No bookings compiled for today. Tap 'Walk-In' to add one."}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-4 py-2.5 bg-secondary/60 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-secondary transition-all active:scale-95 duration-100"
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
                            className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden"
                        >
                            {/* Slot header */}
                            <div className="px-6 pt-5 pb-3 border-b border-border bg-secondary/40">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-primary font-black text-xl leading-none">
                                                {slot.timeLabel.split(' ')[0]}
                                            </p>
                                            <p className="text-muted-foreground text-xs font-bold">
                                                {slot.timeLabel.split(' ')[1]}
                                            </p>
                                        </div>
                                        <div className="w-px h-8 bg-secondary" />
                                        <div>
                                            <p className="text-foreground font-bold text-sm">
                                                Session — {slot.timeLabel}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                {totalCount} student{totalCount !== 1 ? 's' : ''} expected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        {!allMarked && (
                                            <button
                                                onClick={() => handleMarkAllIn(slot)}
                                                disabled={bulkPendingSlot === slot.time}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 duration-100 disabled:opacity-60 bg-success/10 text-success border-success/20 hover:bg-success/20 hover:border-success/30"
                                            >
                                                {bulkPendingSlot === slot.time
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <CheckCircle2 className="w-3.5 h-3.5" />
                                                }
                                                {bulkPendingSlot === slot.time ? 'Marking...' : 'Mark All In'}
                                            </button>
                                        )}
                                        {missingOut > 0 && (
                                            <span className="flex items-center gap-1.5 text-warning text-xs font-bold px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {missingOut} no check-out
                                            </span>
                                        )}
                                        {allMarked ? (
                                            <span className="flex items-center gap-1.5 text-success text-xs font-bold px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-warning text-xs font-bold px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                                {/* Regular register */}
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                                            Regular Register
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground border border-border">
                                            {slot.regulars.length} scheduled
                                        </span>
                                    </div>

                                    {slot.regulars.length === 0 ? (
                                        <p className="text-center text-muted-foreground/60 text-xs py-8 italic border-2 border-dashed border-border rounded-2xl">
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
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/20">
                                            {slot.catchups.length} guest{slot.catchups.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {slot.catchups.length === 0 ? (
                                        <p className="text-center text-muted-foreground/60 text-xs py-8 italic border-2 border-dashed border-border rounded-2xl">
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
                    <div className="bg-card rounded-t-3xl sm:rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Register Walk-In</h3>
                                <p className="text-sm text-muted-foreground">Add a child for a one-off session</p>
                            </div>
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="w-9 h-9 rounded-xl bg-secondary/60 hover:bg-secondary flex items-center justify-center text-muted-foreground transition-all active:scale-90 duration-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {centreId !== 'all' && (
                            <div className="flex border-b border-border bg-secondary/40">
                                {(['existing', 'new'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setWalkInTab(tab)}
                                        className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-all active:scale-[0.98] duration-100 ${
                                            walkInTab === tab
                                                ? 'border-primary text-primary bg-card'
                                                : 'border-transparent text-muted-foreground hover:text-muted-foreground'
                                        }`}
                                    >
                                        {tab === 'existing' ? 'Existing Student' : 'New Guest'}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            {centreId === 'all' ? (
                                <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 text-warning text-sm font-semibold">
                                    ⚠ Please select a specific centre from the sidebar before registering a walk-in.
                                </div>
                            ) : (
                                <>
                                    {walkInTab === 'existing' ? (
                                        <>
                                            <div>
                                                <label className={formLabel}>Search Students</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
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
                                                                <p className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed border-border rounded-2xl">
                                                                    No available students found.
                                                                </p>
                                                            ) : available.map(student => (
                                                                <button
                                                                    key={student.id}
                                                                    type="button"
                                                                    onClick={() => setSelectedChildId(student.id)}
                                                                    className={`w-full text-left p-3.5 rounded-xl border text-sm flex justify-between items-center transition-all ${
                                                                        selectedChildId === student.id
                                                                            ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/20'
                                                                            : 'bg-card border-border hover:border-primary/30'
                                                                    }`}
                                                                >
                                                                    <div>
                                                                        <div>{student.firstName} {student.lastName} <span className="text-muted-foreground font-normal">(Yr {student.schoolYear})</span></div>
                                                                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                                                                            {student.parentFirstName} {student.parentLastName}
                                                                        </div>
                                                                    </div>
                                                                    {selectedChildId === student.id && <UserCheck className="w-5 h-5 text-primary" />}
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
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className={formLabel}>Date of Birth *</label>
                                                    <input type="date" required value={formChildDob} onChange={e => setFormChildDob(e.target.value)} className={formInput} />
                                                </div>
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
                                            <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
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
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/40">
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="h-11 px-5 rounded-xl bg-card border border-border text-foreground text-sm font-bold hover:bg-secondary/60 transition-all active:scale-95 duration-100"
                            >
                                Cancel
                            </button>
                            {centreId !== 'all' && (
                                <button
                                    onClick={handleWalkInSubmit}
                                    disabled={isSubmitting}
                                    className="h-11 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-primary-foreground text-sm font-bold transition-all flex items-center gap-2 shadow-sm shadow-emerald-200 active:scale-95 duration-100"
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
