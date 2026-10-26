'use client';

import { useState, useTransition, useOptimistic, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAvatarGradient } from '@/components/ui/utils';
import Link from 'next/link';
import { markAttendeeAttendance, registerWalkInChild, registerExistingChildWalkIn } from '@/features/bookings/actions';
import { updateAttendanceTimelog } from '@/features/attendance/actions';
import {
    CheckCircle2, XCircle, AlertCircle, Loader2, Plus, Search, X,
    Users, Sparkles, UserCheck, LogIn, LogOut, ChevronDown, BookOpen, AlertTriangle, BookMarked
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';


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
export function AttendeeCard({
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
    const savedIds = useRef({ bookingId: attendee.bookingId, attendeeId: attendee.id });

    const [checkIn,  setCheckIn]  = useState<string>(attendee.checkInTime  ?? '');
    const [checkOut, setCheckOut] = useState<string>(attendee.checkOutTime ?? '');
    const [isAbsent, setIsAbsent] = useState<boolean>(attendee.attendanceStatus === 'absent');
    const [absenceReason, setAbsenceReason] = useState<string>(attendee.attendanceStatus === 'absent' ? attendee.attendanceNote || 'other' : '');
    const [note, setNote] = useState<string>(attendee.attendanceNote ?? '');
    const [showAbsenceSheet, setShowAbsenceSheet] = useState(false);
    const [saved, setSaved]   = useState(false);
    const [isPending, startTransition] = useTransition();

    const derivedLate = checkIn ? lateMinutesFrom(checkIn, sessionTime) : null;
    const isIn  = !!checkIn;
    const isOut = !!checkOut;
    const isExtra = attendee.sessionType === 'extra';

    const ensureBooking = async (): Promise<{ bookingId: string; attendeeId: string }> => {
        const { bookingId, attendeeId } = savedIds.current;
        if (bookingId && !bookingId.startsWith('temp-') && attendeeId && !attendeeId.startsWith('temp-')) {
            return { bookingId, attendeeId };
        }
        const res = await markAttendeeAttendance({
            bookingId, attendeeId,
            status: null, note: null, lateMinutes: null,
            childId: attendee.childId, dateStr, sessionTime, centreId,
        });
        if (res?.bookingId && res.attendeeId) {
            savedIds.current = { bookingId: res.bookingId, attendeeId: res.attendeeId };
            return { bookingId: res.bookingId, attendeeId: res.attendeeId };
        }
        throw new Error('Could not create booking record');
    };

    const confirmed = useRef({ checkIn, checkOut, isAbsent, absenceReason });
    const saving = useRef(false);
    const [saveError, setSaveError] = useState(false);
    const retry = useRef<(() => void) | null>(null);
    useEffect(() => {
        const next = { checkIn: attendee.checkInTime ?? '', checkOut: attendee.checkOutTime ?? '', isAbsent: attendee.attendanceStatus === 'absent', absenceReason: '' };
        confirmed.current = next;
        setCheckIn(next.checkIn); setCheckOut(next.checkOut); setIsAbsent(next.isAbsent); setAbsenceReason('');
    }, [attendee.checkInTime, attendee.checkOutTime, attendee.attendanceStatus]);
    const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
    type Snapshot = typeof confirmed.current;
    const applyState = (state: Snapshot) => {
        setCheckIn(state.checkIn); setCheckOut(state.checkOut);
        setIsAbsent(state.isAbsent); setAbsenceReason(state.absenceReason);
    };
    const persist = (next: Snapshot) => {
        if (saving.current) return;
        saving.current = true; setSaved(false); setSaveError(false);
        setShowAbsenceSheet(false);
        retry.current = () => persist(next);
        startTransition(async () => {
            try {
                // Keep a returned attendee ID even if the second write fails, so retry
                // updates that record instead of creating another booking.
                const { attendeeId } = await ensureBooking();
                await updateAttendanceTimelog({ attendeeId, checkInTime: next.checkIn || null,
                    checkOutTime: next.checkOut || null, dateStr,
                    absenceReason: next.isAbsent ? next.absenceReason as 'illness' | 'holiday' | 'family' | 'other' : null,
                    attendanceNote: note || null, sessionTime, clearAttendance: !next.checkIn && !next.checkOut && !next.isAbsent });
                confirmed.current = next; applyState(next);
                onStatusChange?.(attendee.id, { checkedIn: !!next.checkIn, checkedOut: !!next.checkOut, absent: next.isAbsent });
                retry.current = null; flashSaved();
            } catch {
                applyState(confirmed.current);
                setSaveError(true);
                onToast({ title: 'Attendance save not confirmed', message: 'Check the warning on this student before continuing.', variant: 'error' });
            } finally { saving.current = false; }
        });
    };
    const saveTimeBlur = (type: 'in' | 'out', val: string) => {
        if (!val) { applyState(confirmed.current); return; }
        persist({ ...confirmed.current, [type === 'in' ? 'checkIn' : 'checkOut']: val, isAbsent: false, absenceReason: '' });
    };
    const handleCheckIn = () => persist({ ...confirmed.current, checkIn: nowHHmm(), isAbsent: false, absenceReason: '' });
    const handleCheckOut = () => persist({ ...confirmed.current, checkOut: nowHHmm() });
    const handleMarkAbsent = (reason: typeof ABSENCE_REASONS[number]['key']) => persist({ checkIn: '', checkOut: '', isAbsent: true, absenceReason: reason });
    const handleUndoAbsent = () => persist({ checkIn: '', checkOut: '', isAbsent: false, absenceReason: '' });

    const initials = `${(attendee.firstName || '')[0] || ''}${(attendee.lastName || '')[0] || ''}`.toUpperCase() || '??';

    // ── Status-driven visual tokens ──────────────────────────────────────────
    // Left border bar + card background
    const cardClass = isAbsent
        ? 'border-l-4 border-l-danger bg-danger-soft/40 border border-danger/20'
        : (isIn && isOut)
        ? 'border-l-4 border-l-accent bg-accent-soft/40 border border-accent/20'
        : isIn
        ? 'border-l-4 border-l-emerald-500 bg-success-soft/40 border border-emerald-500/20'
        : 'border-l-4 border-l-border bg-surface border border-border hover:border-accent/40';

    const avatarClass = `bg-gradient-to-br ${getAvatarGradient(attendee.firstName)} text-white`;

    return (
        <div className={`group flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3 rounded-md ${cardClass} hover:bg-page/40 transition-colors ${isAbsent ? 'opacity-70' : ''}`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass}`}>
                    {initials}
                </div>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/dashboard/students/${attendee.childId}`} className="font-semibold text-text hover:text-accent transition-colors text-sm">
                            {attendee.firstName} {attendee.lastName}
                        </Link>
                        {isExtra && <Badge variant="warning">Extra</Badge>}
                        {attendee.flagBehaviour && <span title="Behaviour Note"><AlertTriangle className="w-3.5 h-3.5 text-danger" /></span>}
                        {attendee.flagHomework && <span title="Homework Note"><BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /></span>}
                        {derivedLate !== null && isIn && (
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 ml-1">Late {derivedLate}m</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                        <span>Yr {attendee.schoolYear} · </span>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white bg-gradient-to-br ${getAvatarGradient(attendee.parentFirstName)}`}>
                            {attendee.parentFirstName?.[0]}{attendee.parentLastName?.[0]}
                        </div>
                        <span>{attendee.parentFirstName} {attendee.parentLastName} {attendee.parentPhone ? `· ${attendee.parentPhone}` : ''}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {saveError && <div role="alert" className="max-w-md text-sm text-destructive">
                    <p>Save not confirmed. Showing the last confirmed values. Some changes may have reached the server.</p>
                    <div className="mt-1 flex gap-2"><Button size="sm" variant="outline" disabled={isPending} onClick={() => retry.current?.()}>Retry save</Button><Button size="sm" variant="ghost" onClick={() => window.location.reload()}>Reload saved register</Button></div>
                </div>}
            <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap">
                {isAbsent ? (
                    <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
                        <span className="text-xs font-semibold text-danger mr-2">Absent{absenceReason ? ` — ${absenceReason}` : ''}</span>
                        <Button size="sm" variant="outline" onClick={handleUndoAbsent} disabled={isPending}>Undo</Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={isIn ? 'secondary' : 'outline'}
                                onClick={handleCheckIn}
                                disabled={isPending || isIn}
                                className={isIn ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : ''}
                            >
                                {isIn ? 'In' : 'Check In'}
                            </Button>
                            {isIn && (
                                <input
                                    type="time"
                                    aria-label={`Check-in time for ${attendee.firstName} ${attendee.lastName}`}
                                    value={checkIn}
                                    onChange={e => setCheckIn(e.target.value)}
                                    onBlur={e => saveTimeBlur('in', e.target.value)}
                                    disabled={!isIn || isPending}
                                    className="h-8 w-24 px-2 text-xs rounded-sm border border-border bg-surface text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={isOut ? 'secondary' : 'outline'}
                                onClick={handleCheckOut}
                                disabled={isPending || isOut || !isIn}
                                className={isOut ? 'text-accent border-accent/30' : ''}
                            >
                                {isOut ? 'Out' : 'Check Out'}
                            </Button>
                            {isOut && (
                                <input
                                    type="time"
                                    aria-label={`Check-out time for ${attendee.firstName} ${attendee.lastName}`}
                                    value={checkOut}
                                    onChange={e => setCheckOut(e.target.value)}
                                    onBlur={e => saveTimeBlur('out', e.target.value)}
                                    disabled={!isOut || isPending}
                                    className="h-8 w-24 px-2 text-xs rounded-sm border border-border bg-surface text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                                />
                            )}
                        </div>

                        {!isIn && (
                            <div className="relative">
                                <Button size="sm" variant="outline" onClick={() => setShowAbsenceSheet(v => !v)} disabled={isPending} className="hover:text-danger hover:border-danger/30">
                                    Mark Absent
                                </Button>
                                {showAbsenceSheet && (
                                    <div className="absolute top-full right-0 mt-1 w-48 bg-surface border border-border rounded-md shadow-[var(--shadow-popover)] z-10 p-2 grid grid-cols-2 gap-1">
                                        {ABSENCE_REASONS.map(r => (
                                            <button key={r.key} onClick={() => handleMarkAbsent(r.key)} className="flex flex-col items-center py-2 rounded-sm hover:bg-danger-soft border border-transparent hover:border-danger/20">
                                                <span className="text-lg mb-1">{r.emoji}</span>
                                                <span className="text-[10px] font-semibold text-text">{r.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className="w-5 shrink-0 flex justify-center">
                    {isPending && <span role="status" aria-label="Saving attendance"><Loader2 className="w-4 h-4 text-text-muted animate-spin" /></span>}
                    {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>}
                </div>
            </div>
            </div>
        </div>
    );
}

// ─── Slot progress bar ────────────────────────────────────────────────────────
function SlotProgressBar({ marked, total }: { marked: number; total: number }) {
    const pct = total > 0 ? Math.round((marked / total) * 100) : 0;
    return (
        <div className="h-1.5 w-full bg-border-subtle rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-accent'}`}
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
    const [bulkError, setBulkError] = useState('');

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
        setBulkError('');
        setBulkPendingSlot(slot.time);
        try {
            const results = await Promise.all(
                unmarked.map(async (a) => {
                    try {
                        const result = await markAttendeeAttendance({
                            bookingId: a.bookingId, attendeeId: a.id,
                            status: 'present', note: null, lateMinutes: null,
                            childId: a.childId, dateStr, sessionTime: slot.time, centreId,
                        });
                        if (!result?.attendeeId) throw new Error('Attendance record missing');
                        await updateAttendanceTimelog({ attendeeId: result.attendeeId, checkInTime: nowHHmm(), checkOutTime: null, dateStr, sessionTime: slot.time });
                        updateMarkedStatus(a.id, { checkedIn: true, absent: false });
                        return true;
                    } catch { return false; }
                })
            );
            const succeeded = results.filter(Boolean).length;
            if (succeeded !== unmarked.length) setBulkError(`${succeeded} of ${unmarked.length} check-ins confirmed. Some changes may have reached the server. Reload the saved register before retrying.`);
            toast({ title: `${succeeded} of ${unmarked.length} check-ins confirmed`, message: succeeded === unmarked.length ? 'Saved successfully. Reload to see updated times.' : 'Check the warning above the register.', variant: succeeded === unmarked.length ? 'success' : 'error' });
            if (succeeded === unmarked.length) router.refresh();
        } catch {
            toast({ title: 'Bulk mark failed', message: 'Some students could not be marked. Refresh and retry.', variant: 'error' });
        } finally {
            setBulkPendingSlot(null);
        }
    };

    const handleMarkAllOut = async (slot: CompiledSlot) => {
        const allAttendees = [...slot.regulars, ...slot.catchups];
        const time = nowHHmm();

        const inButNotOut = allAttendees.filter(a => {
            const s = markedStatus[a.id];
            return s ? (s.checkedIn && !s.checkedOut && !s.absent) : (!!a.checkInTime && !a.checkOutTime);
        });

        if (inButNotOut.length === 0) {
            toast({ title: 'Nobody to check out', message: 'All checked-in students are already checked out.', variant: 'warning' });
            return;
        }

        setBulkError('');
        setBulkPendingSlot(`out-${slot.time}`);
        try {
            const results = await Promise.all(
                inButNotOut.map(async (a) => {
                    try {
                        let bkId = a.bookingId;
                        let attId = a.id;
                        if (!bkId || bkId.startsWith('temp-')) {
                             const res = await markAttendeeAttendance({
                                bookingId: a.bookingId, attendeeId: a.id,
                                status: 'present', note: null, lateMinutes: null,
                                childId: a.childId, dateStr, sessionTime: slot.time, centreId,
                            });
                            if (res) {
                                bkId = res.bookingId!;
                                attId = res.attendeeId!;
                            }
                        }

                        await updateAttendanceTimelog({
                            attendeeId: attId, checkInTime: a.checkInTime || time, checkOutTime: time,
                            dateStr, absenceReason: null, attendanceNote: null, sessionTime: slot.time
                        });

                        updateMarkedStatus(a.id, { checkedOut: true });
                        return true;
                    } catch { return false; }
                })
            );
            const succeeded = results.filter(Boolean).length;
            if (succeeded !== inButNotOut.length) setBulkError(`${succeeded} of ${inButNotOut.length} check-outs confirmed. Some changes may have reached the server. Reload the saved register before retrying.`);
            toast({ title: `${succeeded} of ${inButNotOut.length} check-outs confirmed`, message: succeeded === inButNotOut.length ? 'Saved successfully. Reload to see updated times.' : 'Check the warning above the register.', variant: succeeded === inButNotOut.length ? 'success' : 'error' });
            if (succeeded === inButNotOut.length) router.refresh();
        } catch {
            toast({ title: 'Bulk mark out failed', message: 'Refresh and try again.', variant: 'error' });
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
    const formInput = 'w-full h-9 px-3 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors';
    const formLabel = 'block text-label text-text-muted mb-1.5';

    return (
        <div className="space-y-5">
            {bulkError && <div role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive"><p>{bulkError}</p><Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload saved register</Button></div>}

            {/* ── Sticky action bar ─────────────────────────────────────────── */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-page/90 backdrop-blur-sm border-b border-border-subtle flex flex-col sm:flex-row items-stretch gap-2.5">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search students or parents…"
                        aria-label="Search register students or parents"
                        className="w-full h-11 pl-10 pr-10 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-sm hover:bg-page text-text-muted hover:text-text transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                    <Button size="lg" className="flex-1 sm:flex-none" onClick={() => setShowWalkIn(true)}>
                        <Plus className="w-4 h-4" />
                        Walk-In
                    </Button>
                    <Button variant="outline" size="lg" className="flex-1 sm:flex-none" asChild>
                        <Link href="/dashboard/attendance/ledger">
                            <BookMarked className="w-4 h-4" />
                            Ledger
                        </Link>
                    </Button>
                </div>
            </div>

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {filteredSlots.length === 0 ? (
                <EmptyState
                    icon={<Users className="w-7 h-7" />}
                    title="No students found"
                    description={
                        searchQuery
                            ? 'No scheduled students match your search.'
                            : "No bookings compiled for today. Tap 'Walk-In' to add one."
                    }
                    action={
                        searchQuery
                            ? <Button variant="outline" onClick={() => setSearchQuery('')}>Clear search</Button>
                            : undefined
                    }
                />
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
                        <Card key={slot.time} className="overflow-hidden">
                            {/* Slot header */}
                            <div className="px-6 pt-5 pb-3 border-b border-border-subtle bg-page/60">
                                <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-accent font-bold text-xl leading-none">
                                                {slot.timeLabel.split(' ')[0]}
                                            </p>
                                            <p className="text-text-muted text-xs font-semibold">
                                                {slot.timeLabel.split(' ')[1]}
                                            </p>
                                        </div>
                                        <div className="w-px h-8 bg-border-subtle" />
                                        <div>
                                            <p className="text-text font-semibold text-sm">
                                                Session — {slot.timeLabel}
                                            </p>
                                            <p className="text-text-muted text-xs">
                                                {totalCount} student{totalCount !== 1 ? 's' : ''} expected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        {!allMarked && (
                                            <button
                                                onClick={() => handleMarkAllIn(slot)}
                                                disabled={bulkPendingSlot !== null || !!bulkError}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 bg-success-soft text-emerald-700 dark:text-emerald-400 border-transparent hover:opacity-80"
                                            >
                                                {bulkPendingSlot === slot.time
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <CheckCircle2 className="w-3.5 h-3.5" />
                                                }
                                                {bulkPendingSlot === slot.time ? 'Marking...' : 'Mark All In'}
                                            </button>
                                        )}
                                        {missingOut > 0 && (
                                            <button
                                                onClick={() => handleMarkAllOut(slot)}
                                                disabled={bulkPendingSlot !== null || !!bulkError}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 bg-warning-soft text-amber-700 dark:text-amber-400 border-transparent hover:opacity-80"
                                            >
                                                {bulkPendingSlot === `out-${slot.time}`
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <LogOut className="w-3.5 h-3.5" />
                                                }
                                                Check {missingOut} Out (EOD)
                                            </button>
                                        )}
                                        {allMarked ? (
                                            <Badge variant="success">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                            </Badge>
                                        ) : (
                                            <Badge variant="warning">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {markedCount}/{totalCount} marked
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <SlotProgressBar marked={markedCount} total={totalCount} />
                            </div>

                            {/* Two-column grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
                                {/* Regular register */}
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-label text-text-muted">
                                            Regular Register
                                        </h4>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-page text-text-muted border border-border-subtle">
                                            {slot.regulars.length} scheduled
                                        </span>
                                    </div>

                                    {slot.regulars.length === 0 ? (
                                        <p className="text-center text-text-muted text-xs py-8 italic border border-dashed border-border rounded-md">
                                            No regular students scheduled for this slot.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            {slot.regulars.map(child => (
                                                <AttendeeCard
                                                    key={`${dateStr}-${child.id}`}
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
                                            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                            <h4 className="text-label text-amber-700 dark:text-amber-400">
                                                Catch-Ups & Walk-Ins
                                            </h4>
                                        </div>
                                        <Badge variant="warning">
                                            {slot.catchups.length} guest{slot.catchups.length !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>

                                    {slot.catchups.length === 0 ? (
                                        <p className="text-center text-text-muted text-xs py-8 italic border border-dashed border-border rounded-md">
                                            No catch-ups or walk-ins registered.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            {slot.catchups.map(child => (
                                                <AttendeeCard
                                                    key={`${dateStr}-${child.id}`}
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
                        </Card>
                    );
                })
            )}

            {/* ── Walk-In Modal ─────────────────────────────────────────────── */}
            {showWalkIn && (
                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
                    <div className="bg-surface border border-border rounded-t-lg sm:rounded-lg max-w-lg w-full overflow-hidden shadow-[var(--shadow-popover)]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
                            <div>
                                <h3 className="text-section-title text-text">Register Walk-In</h3>
                                <p className="text-small-body text-text-secondary">Add a child for a one-off session</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowWalkIn(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {centreId !== 'all' && (
                            <div className="flex border-b border-border-subtle bg-page/60">
                                {(['existing', 'new'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setWalkInTab(tab)}
                                        className={`flex-1 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                                            walkInTab === tab
                                                ? 'border-accent text-accent bg-surface'
                                                : 'border-transparent text-text-muted hover:text-text'
                                        }`}
                                    >
                                        {tab === 'existing' ? 'Existing Student' : 'New Guest'}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            {centreId === 'all' ? (
                                <div className="p-4 rounded-md bg-warning-soft border border-transparent text-amber-700 dark:text-amber-400 text-sm font-medium">
                                    Please select a specific centre from the sidebar before registering a walk-in.
                                </div>
                            ) : (
                                <>
                                    {walkInTab === 'existing' ? (
                                        <>
                                            <div>
                                                <label className={formLabel}>Search Students</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
                                                    <input
                                                        type="text"
                                                        value={studentSearchQuery}
                                                        onChange={e => setStudentSearchQuery(e.target.value)}
                                                        placeholder="Search by name…"
                                                        aria-label="Search students for walk-in attendance"
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
                                                                <p className="text-sm text-text-muted py-6 text-center border border-dashed border-border rounded-md">
                                                                    No available students found.
                                                                </p>
                                                            ) : available.map(student => (
                                                                <button
                                                                    key={student.id}
                                                                    type="button"
                                                                    onClick={() => setSelectedChildId(student.id)}
                                                                    className={`w-full text-left p-3 rounded-sm border text-sm flex justify-between items-center transition-colors ${
                                                                        selectedChildId === student.id
                                                                            ? 'bg-accent-soft border-accent/50'
                                                                            : 'bg-surface border-border hover:border-accent/30'
                                                                    }`}
                                                                >
                                                                    <div>
                                                                        <div className="text-text">{student.firstName} {student.lastName} <span className="text-text-muted font-normal">(Yr {student.schoolYear})</span></div>
                                                                        <div className="text-xs text-text-muted font-normal mt-0.5">
                                                                            {student.parentFirstName} {student.parentLastName}
                                                                        </div>
                                                                    </div>
                                                                    {selectedChildId === student.id && <UserCheck className="w-5 h-5 text-accent" />}
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
                                            <div className="pt-3 border-t border-border-subtle grid grid-cols-2 gap-3">
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
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-page/60">
                            <Button variant="outline" onClick={() => setShowWalkIn(false)}>
                                Cancel
                            </Button>
                            {centreId !== 'all' && (
                                <Button onClick={handleWalkInSubmit} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {walkInTab === 'existing' ? 'Add to Register' : 'Register & Check In'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
