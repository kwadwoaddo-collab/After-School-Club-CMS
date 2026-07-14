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
    // Time-log fields
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

/** Returns current time as "HH:mm" */
function nowHHmm(): string {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

/** Derives lateness: returns minutes if > 10min after slot, else null */
function lateMinutesFrom(checkIn: string, slot: string): number | null {
    const [ih, im] = checkIn.split(':').map(Number);
    const [sh, sm] = slot.split(':').map(Number);
    const diff = (ih * 60 + im) - (sh * 60 + sm);
    return diff > 10 ? diff : null;
}

function AttendeeCard({
    attendee,
    dateStr,
    sessionTime,
    centreId,
    onToast,
}: {
    attendee: Attendee;
    dateStr: string;
    sessionTime: string;
    centreId: string;
    onToast: ReturnType<typeof useToast>['toast'];
}) {
    const [curBookingId, setCurBookingId] = useState<string | null>(attendee.bookingId);
    const [curAttendeeId, setCurAttendeeId] = useState<string | null>(attendee.id);

    const [checkIn, setCheckIn] = useState<string>(attendee.checkInTime ?? '');
    const [checkOut, setCheckOut] = useState<string>(attendee.checkOutTime ?? '');
    const [isAbsent, setIsAbsent] = useState(attendee.attendanceStatus === 'absent');
    const [absenceReason, setAbsenceReason] = useState<string>('');
    const [note, setNote] = useState<string>(attendee.attendanceNote ?? '');
    const [showAbsenceSelect, setShowAbsenceSelect] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isPending, startTransition] = useTransition();

    const derivedLate = checkIn ? lateMinutesFrom(checkIn, sessionTime) : null;
    const isIn = !!checkIn;
    const isOut = !!checkOut;
    const isExtra = attendee.isCatchUp || attendee.sessionType === 'extra';

    const ensureBooking = async (): Promise<{ bookingId: string; attendeeId: string }> => {
        if (curBookingId && !curBookingId.startsWith('temp-') && curAttendeeId && !curAttendeeId.startsWith('temp-')) {
            return { bookingId: curBookingId, attendeeId: curAttendeeId };
        }
        const res = await markAttendeeAttendance({
            bookingId: curBookingId,
            attendeeId: curAttendeeId,
            status: 'present',
            note: null,
            lateMinutes: null,
            childId: attendee.childId,
            dateStr,
            sessionTime,
            centreId,
        });
        if (res) {
            setCurBookingId(res.bookingId);
            setCurAttendeeId(res.attendeeId ?? null);
            return { bookingId: res.bookingId, attendeeId: res.attendeeId! };
        }
        throw new Error('Could not create booking record');
    };

    const handleCheckIn = () => {
        const time = nowHHmm();
        setCheckIn(time);
        setIsAbsent(false);
        setShowAbsenceSelect(false);
        startTransition(async () => {
            try {
                const { attendeeId } = await ensureBooking();
                await updateAttendanceTimelog({ attendeeId, checkInTime: time, checkOutTime: checkOut || null, absenceReason: null, attendanceNote: note || null, sessionTime });
                setSaved(true); setTimeout(() => setSaved(false), 2000);
            } catch { onToast({ title: 'Could not record check-in', message: 'Please try again.', variant: 'error' }); setCheckIn(''); }
        });
    };

    const handleCheckOut = () => {
        const time = nowHHmm();
        setCheckOut(time);
        startTransition(async () => {
            try {
                const { attendeeId } = await ensureBooking();
                await updateAttendanceTimelog({ attendeeId, checkInTime: checkIn || null, checkOutTime: time, absenceReason: null, attendanceNote: note || null, sessionTime });
                setSaved(true); setTimeout(() => setSaved(false), 2000);
            } catch { onToast({ title: 'Could not record check-out', message: 'Please try again.', variant: 'error' }); setCheckOut(''); }
        });
    };

    const handleMarkAbsent = (reason: 'illness' | 'holiday' | 'family' | 'other') => {
        setIsAbsent(true); setAbsenceReason(reason); setCheckIn(''); setCheckOut(''); setShowAbsenceSelect(false);
        startTransition(async () => {
            try {
                const res = await markAttendeeAttendance({ bookingId: curBookingId, attendeeId: curAttendeeId, status: 'absent', note: reason, lateMinutes: null, childId: attendee.childId, dateStr, sessionTime, centreId });
                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) { setCurBookingId(res.bookingId); setCurAttendeeId(res.attendeeId ?? null); }
                if (res?.attendeeId) { await updateAttendanceTimelog({ attendeeId: res.attendeeId, checkInTime: null, checkOutTime: null, absenceReason: reason, attendanceNote: null, sessionTime }); }
                setSaved(true); setTimeout(() => setSaved(false), 2000);
            } catch { onToast({ title: 'Could not mark absent', message: 'Please try again.', variant: 'error' }); }
        });
    };

    const initials = `${attendee.firstName[0]}${attendee.lastName[0]}`.toUpperCase();
    const borderClass = isAbsent ? 'bg-red-50 border-red-200' : isIn && isOut ? 'bg-emerald-50 border-emerald-200' : isIn ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200';
    const avatarClass = isAbsent ? 'bg-red-100 text-red-600' : isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';

    return (
        <div className={`rounded-2xl border p-4 transition-all ${borderClass}`}>
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarClass}`}>
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/dashboard/students/${attendee.childId}`} className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors">
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
                        {saved && <span className="text-[10px] font-bold text-emerald-600 animate-pulse">Saved ✓</span>}
                        {isPending && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        Year {attendee.schoolYear} · {attendee.parentFirstName} {attendee.parentLastName}
                        {attendee.parentPhone && ` · ${attendee.parentPhone}`}
                    </p>

                    {isAbsent ? (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1.5 rounded-xl bg-red-100 border border-red-200 text-red-700 text-xs font-bold">
                                ❌ Absent{absenceReason ? ` — ${absenceReason}` : ''}
                            </span>
                            <button onClick={() => { setIsAbsent(false); setAbsenceReason(''); }} className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors">Undo</button>
                        </div>
                    ) : (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            {/* CHECK IN */}
                            <button
                                onClick={handleCheckIn}
                                disabled={isPending}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    isIn ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'
                                }`}
                            >
                                <LogIn className="w-3.5 h-3.5" />
                                {isIn ? `In ${checkIn}` : 'Check In'}
                            </button>
                            {isIn && (
                                <input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                                    className="h-8 px-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
                                    title="Edit check-in time" />
                            )}
                            {/* CHECK OUT */}
                            {isIn && (
                                <button
                                    onClick={handleCheckOut}
                                    disabled={isPending}
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                        isOut ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
                                    }`}
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    {isOut ? `Out ${checkOut}` : 'Check Out'}
                                </button>
                            )}
                            {isIn && isOut && (
                                <input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                                    className="h-8 px-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
                                    title="Edit check-out time" />
                            )}
                            {/* ABSENT dropdown */}
                            {!isIn && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowAbsenceSelect(!showAbsenceSelect)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Mark Absent <ChevronDown className="w-3 h-3" />
                                    </button>
                                    {showAbsenceSelect && (
                                        <div className="absolute bottom-full left-0 mb-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                                            {(['illness', 'holiday', 'family', 'other'] as const).map(r => (
                                                <button key={r} onClick={() => handleMarkAbsent(r)}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-red-50 hover:text-red-700 capitalize transition-colors"
                                                >
                                                    {r === 'illness' ? '🤒 Illness' : r === 'holiday' ? '✈️ Holiday' : r === 'family' ? '👪 Family' : '📋 Other'}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AttendanceRollCall({ slots, centreId, dateStr, allStudents = [] }: Props) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Walk-in Modality Tabs
    const [walkInTab, setWalkInTab] = useState<'existing' | 'new'>('existing');
    const [selectedChildId, setSelectedChildId] = useState('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');

    // Walk-in Form States
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

                await registerExistingChildWalkIn({
                    centreId,
                    dateStr,
                    childId: selectedChildId,
                    sessionTime: formSessionTime,
                });

                const childObj = allStudents.find(s => s.id === selectedChildId);
                toast({ title: `${childObj?.firstName || 'Student'} added successfully`, message: 'They have been added to today\'s session.', variant: 'success' });
            } else {
                if (!formChildFirst || !formChildLast || !formParentFirst || !formParentLast || !formParentEmail) {
                    toast({ title: 'Missing information', message: 'Please fill in all required fields before submitting.', variant: 'warning' });
                    setIsSubmitting(false);
                    return;
                }

                await registerWalkInChild({
                    centreId,
                    dateStr,
                    childFirstName: formChildFirst,
                    childLastName: formChildLast,
                    schoolYear: formYear,
                    parentFirstName: formParentFirst,
                    parentLastName: formParentLast,
                    parentEmail: formParentEmail,
                    parentPhone: formParentPhone || undefined,
                    sessionTime: formSessionTime,
                });

                toast({ title: `${formChildFirst} registered successfully`, message: 'They have been added to today\'s session.', variant: 'success' });
            }

            // Reset Form & Close Modal
            setFormChildFirst('');
            setFormChildLast('');
            setFormParentFirst('');
            setFormParentLast('');
            setFormParentEmail('');
            setFormParentPhone('');
            setSelectedChildId('');
            setStudentSearchQuery('');
            setShowWalkIn(false);
        } catch (err: any) {
            toast({ title: 'Could not register student', message: 'Please check the details and try again.', variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter logic
    const filteredSlots = slots
        .map((slot) => {
            const search = searchQuery.toLowerCase().trim();
            if (!search) return slot;

            const matchingRegulars = slot.regulars.filter((child) => {
                const childName = `${child.firstName} ${child.lastName}`.toLowerCase();
                const parentName = `${child.parentFirstName} ${child.parentLastName}`.toLowerCase();
                return childName.includes(search) || parentName.includes(search);
            });

            const matchingCatchups = slot.catchups.filter((child) => {
                const childName = `${child.firstName} ${child.lastName}`.toLowerCase();
                const parentName = `${child.parentFirstName} ${child.parentLastName}`.toLowerCase();
                return childName.includes(search) || parentName.includes(search);
            });

            return {
                ...slot,
                regulars: matchingRegulars,
                catchups: matchingCatchups,
            };
        })
        .filter((slot) => slot.regulars.length > 0 || slot.catchups.length > 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Action Bar — sticky so it stays visible while scrolling through slots */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-background/90/90 backdrop-blur-xl border-b border-border/50 flex flex-col sm:flex-row items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search expected students or parents..."
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border text-foreground placeholder-gray-400 text-sm focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Walk-in Button */}
                <button
                    onClick={() => setShowWalkIn(true)}
                    className="w-full sm:w-auto h-11 px-5 rounded-xl bg-gradient-to-r from-[#adc6ff] to-[#4d8eff] hover:from-[#adc6ff]/90 hover:to-[#4d8eff]/90 text-slate-950 text-sm font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(77,142,255,0.2)]"
                >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Register Catch-Up / Walk-In
                </button>
                <Link
                    href="/dashboard/attendance/ledger"
                    className="w-full sm:w-auto h-11 px-5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-bold transition-all flex items-center justify-center gap-2 hover:bg-gray-50 shadow-sm"
                >
                    <BookMarked className="w-4 h-4" />
                    Session Ledger
                </Link>
            </div>

            {/* List */}
            {filteredSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-[24px] border border-dashed border-border">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                        <Users className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-foreground font-bold mb-2">No expected students found</h3>
                    <p className="text-muted-foreground text-sm max-w-xs px-4">
                        {searchQuery
                            ? "No scheduled children or parent names match your search term."
                            : "There are no bookings or permanent schedules compiled for today. Click 'Register Catch-Up' to add one."}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-4 py-2 bg-secondary/60 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-secondary transition-all"
                        >
                            Clear Search Filter
                        </button>
                    )}
                </div>
            ) : (
                filteredSlots.map((slot) => {
                    const totalCount = slot.regulars.length + slot.catchups.length;
                    const checkedInCount = [...slot.regulars, ...slot.catchups].filter(a => a.checkInTime || a.attendanceStatus === 'absent').length;
                    const allMarked = [...slot.regulars, ...slot.catchups].every(a => a.checkInTime || a.attendanceStatus === 'absent');
                    const missingOut = [...slot.regulars, ...slot.catchups].filter(a => a.checkInTime && !a.checkOutTime).length;

                    return (
                        <div
                            key={slot.time}
                            className="bg-card rounded-[24px] border border-border shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden"
                        >
                            {/* Slot header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/50">
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-primary font-black text-lg leading-none">
                                            {slot.timeLabel.split(' ')[0]}
                                        </p>
                                        <p className="text-muted-foreground text-xs font-bold">
                                            {slot.timeLabel.split(' ')[1]}
                                        </p>
                                    </div>
                                    <div className="w-px h-8 bg-[#424754]/30" />
                                    <div>
                                        <p className="text-foreground font-semibold text-sm">
                                            Session Slot: {slot.timeLabel}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {totalCount} student{totalCount !== 1 ? 's' : ''} expected
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {missingOut > 0 && (
                                        <span className="flex items-center gap-1.5 text-orange-600 text-xs font-bold px-3 py-1 rounded-full bg-orange-50 border border-orange-200">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {missingOut} no check-out
                                        </span>
                                    )}
                                    {allMarked ? (
                                        <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {checkedInCount}/{totalCount} marked
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Split Columns Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#424754]/15">
                                {/* Regular Register (Master List) */}
                                <div className="p-6 space-y-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Regular Register (Master List)</h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary/50 text-muted-foreground border border-border/60">
                                            {slot.regulars.length} Scheduled
                                        </span>
                                    </div>
                                    
                                    {slot.regulars.length === 0 ? (
                                        <p className="text-center text-muted-foreground/55 text-xs py-8 italic border border-dashed border-border/60 rounded-2xl">
                                            No regular students permanently scheduled for this slot.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {slot.regulars.map((child) => (
                                                <AttendeeCard
                                                    key={child.id}
                                                    attendee={child}
                                                    dateStr={dateStr}
                                                    sessionTime={slot.time}
                                                    centreId={centreId}
                                                    onToast={toast}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Catch Ups / One-offs */}
                                <div className="p-6 space-y-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                            <h4 className="text-[11px] font-black text-amber-400 uppercase tracking-wider">Catch Ups &amp; Walk-Ins</h4>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            {slot.catchups.length} Guest{slot.catchups.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    
                                    {slot.catchups.length === 0 ? (
                                        <p className="text-center text-muted-foreground/55 text-xs py-8 italic border border-dashed border-border/60 rounded-2xl">
                                            No one-off catchups or walk-ins registered.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {slot.catchups.map((child) => (
                                                <AttendeeCard
                                                    key={child.id}
                                                    attendee={child}
                                                    dateStr={dateStr}
                                                    sessionTime={slot.time}
                                                    centreId={centreId}
                                                    onToast={toast}
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

            {/* Walk-in Modal */}
            {showWalkIn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border rounded-[28px] max-w-lg w-full overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-secondary/50">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Register Catch-Up or Walk-In</h3>
                                <p className="text-xs text-muted-foreground">Add a child for a one-off session</p>
                            </div>
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="p-2 rounded-xl bg-secondary/60 border border-border/60 text-muted-foreground hover:text-foreground transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {centreId !== 'all' && (
                            /* Tabs */
                            <div className="flex border-b border-border px-6 bg-card">
                                <button
                                    onClick={() => setWalkInTab('existing')}
                                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
                                        walkInTab === 'existing'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground/70'
                                    }`}
                                >
                                    Select Existing Student
                                </button>
                                <button
                                    onClick={() => setWalkInTab('new')}
                                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
                                        walkInTab === 'new'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground/70'
                                    }`}
                                >
                                    Register New Guest
                                </button>
                            </div>
                        )}

                        {/* Form */}
                        <div className="p-6 space-y-4">
                            {centreId === 'all' ? (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold leading-relaxed">
                                    ⚠ Please select a specific centre from the dropdown at the left sidebar before registering a guest.
                                </div>
                            ) : (
                                <>
                                    {walkInTab === 'existing' ? (
                                        <>
                                            {/* Search input */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Search Students</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                    <input
                                                        type="text"
                                                        value={studentSearchQuery}
                                                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                                                        placeholder="Search existing students..."
                                                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder-gray-400 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            {/* List box */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Select Student *</label>
                                                {(() => {
                                                    const bookedChildIds = new Set(
                                                        slots.flatMap(s => [...s.regulars, ...s.catchups].map(a => a.childId))
                                                    );
                                                    const availableStudents = allStudents.filter(
                                                        s => !bookedChildIds.has(s.id) &&
                                                        (`${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                                                         `${s.parentFirstName} ${s.parentLastName}`.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                                                    );

                                                    return (
                                                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                                            {availableStudents.length === 0 ? (
                                                                <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border/60 rounded-2xl">
                                                                    No available students found.
                                                                </p>
                                                            ) : (
                                                                availableStudents.map(student => (
                                                                    <button
                                                                        key={student.id}
                                                                        type="button"
                                                                        onClick={() => setSelectedChildId(student.id)}
                                                                        className={`w-full text-left p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${
                                                                            selectedChildId === student.id
                                                                                ? 'bg-primary/10 border-primary text-foreground font-bold'
                                                                                : 'bg-secondary/60 border-border/60 text-slate-300 hover:bg-secondary'
                                                                        }`}
                                                                    >
                                                                        <div>
                                                                            <div>{student.firstName} {student.lastName} (Year {student.schoolYear})</div>
                                                                            <div className="text-[10px] text-muted-foreground font-normal mt-0.5">Parent: {student.parentFirstName} {student.parentLastName} ({student.parentEmail})</div>
                                                                        </div>
                                                                        {selectedChildId === student.id && <UserCheck className="w-4 h-4 text-primary" />}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Session time */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Session Time</label>
                                                <select
                                                    value={formSessionTime}
                                                    onChange={(e) => setFormSessionTime(e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                >
                                                    {['15:45', '17:00', '11:00', '12:15', '13:30', '14:45'].map(t => (
                                                        <option key={t} value={t} className="bg-card text-foreground">{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Child details */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Child First Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formChildFirst}
                                                        onChange={(e) => setFormChildFirst(e.target.value)}
                                                        placeholder="e.g. John"
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder-gray-400 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Child Last Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formChildLast}
                                                        onChange={(e) => setFormChildLast(e.target.value)}
                                                        placeholder="e.g. Doe"
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder-gray-400 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">School Year</label>
                                                    <select
                                                        value={formYear}
                                                        onChange={(e) => setFormYear(e.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    >
                                                        {['Nursery', 'Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(yr => (
                                                            <option key={yr} value={yr} className="bg-card text-foreground">Year {yr}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Session Time</label>
                                                    <select
                                                        value={formSessionTime}
                                                        onChange={(e) => setFormSessionTime(e.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    >
                                                        {['15:45', '17:00', '11:00', '12:15', '13:30', '14:45'].map(t => (
                                                            <option key={t} value={t} className="bg-card text-foreground">{t}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Parent details */}
                                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Parent First Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formParentFirst}
                                                        onChange={(e) => setFormParentFirst(e.target.value)}
                                                        placeholder="e.g. Mary"
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder-gray-400 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Parent Last Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formParentLast}
                                                        onChange={(e) => setFormParentLast(e.target.value)}
                                                        placeholder="e.g. Doe"
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder-gray-400 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Parent Email *</label>
                                                    <input
                                                        type="email"
                                                        required
                                                        value={formParentEmail}
                                                        onChange={(e) => setFormParentEmail(e.target.value)}
                                                        placeholder="e.g. mary@gmail.com"
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder-gray-400 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Parent Phone</label>
                                                    <input
                                                        type="tel"
                                                        value={formParentPhone}
                                                        onChange={(e) => setFormParentPhone(e.target.value)}
                                                        placeholder="e.g. 07123456789"
                                                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder-gray-400 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/50">
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="px-4 py-2 rounded-xl bg-secondary/60 border border-border text-foreground/70 hover:text-foreground text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                            {centreId !== 'all' && (
                                <button
                                    onClick={handleWalkInSubmit}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 disabled:opacity-55 text-foreground text-xs font-bold transition-all flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                                >
                                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
