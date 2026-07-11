'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { markAttendeeAttendance, registerWalkInChild, registerExistingChildWalkIn } from '@/features/bookings/actions';
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2, Edit2, Plus, Search, X, Users, Sparkles, UserCheck } from 'lucide-react';
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    present: { label: 'Present', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    absent: { label: 'Absent', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' },
    late: { label: 'Late', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' },
    no_show: { label: 'No Show', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' },
    excused: { label: 'Excused', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20' },
};

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
            try {
                const res = await markAttendeeAttendance({
                    bookingId: curBookingId,
                    attendeeId: curAttendeeId,
                    status: newStatus,
                    note: note || null,
                    lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
                    childId: attendee.childId,
                    dateStr,
                    sessionTime,
                    centreId,
                });
                
                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId ?? null);
                }
                
                setStatus(newStatus);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            } catch (err: any) {
                onToast({ title: 'Could not mark attendance', message: 'Please try again. If the problem continues, refresh the page.', variant: 'error' });
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
                    setCurAttendeeId(res.attendeeId ?? null);
                }
                
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            } catch (err: any) {
                onToast({ title: 'Could not save details', message: 'Please try again.', variant: 'error' });
            }
        });
    };

    const initials = `${attendee.firstName[0]}${attendee.lastName[0]}`.toUpperCase();
    const cfg = status ? STATUS_CONFIG[status] : null;

    return (
        <div className="space-y-2">
            <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${cfg
                ? `${cfg.bg} ${cfg.border}`
                : 'bg-[#2a2d35]/30 border-[#424754]/20 hover:border-[#adc6ff]/20'
            }`}>
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg ? `${cfg.bg} ${cfg.text}` : 'bg-[#adc6ff]/10 text-[#adc6ff]'}`}>
                    {initials}
                </div>

                {/* Name + details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Link href={`/dashboard/students/${attendee.childId}`} className="text-white hover:text-[#adc6ff] font-semibold text-sm truncate transition-colors">
                            {attendee.firstName} {attendee.lastName}
                        </Link>
                        {(note || lateMinutes) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Has notes/late minutes" />
                        )}
                    </div>
                    <p className="text-[#8c909f] text-[11px] font-medium leading-normal truncate">
                        Year {attendee.schoolYear} · Parent: {attendee.parentFirstName} ({attendee.parentEmail || 'No email'})
                        {lateMinutes && ` · Late: ${lateMinutes}m`}
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
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-[#0d1117]/90 backdrop-blur-xl border-b border-white/5 flex flex-col sm:flex-row items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c909f]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search expected students or parents..."
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#2a2d35]/30 border border-[#424754]/20 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/5 text-[#8c909f] hover:text-white transition-all"
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
            </div>

            {/* List */}
            {filteredSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-[#1a1d23] rounded-[24px] border border-dashed border-[#424754]/25">
                    <div className="w-16 h-16 rounded-2xl bg-[#2a2d35]/40 flex items-center justify-center mb-4">
                        <Users className="w-7 h-7 text-[#8c909f]/40" />
                    </div>
                    <h3 className="text-[#e5e2e1] font-bold mb-2">No expected students found</h3>
                    <p className="text-[#8c909f] text-sm max-w-xs px-4">
                        {searchQuery
                            ? "No scheduled children or parent names match your search term."
                            : "There are no bookings or permanent schedules compiled for today. Click 'Register Catch-Up' to add one."}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all"
                        >
                            Clear Search Filter
                        </button>
                    )}
                </div>
            ) : (
                filteredSlots.map((slot) => {
                    const totalCount = slot.regulars.length + slot.catchups.length;
                    const presentCount = [...slot.regulars, ...slot.catchups].filter(a => a.attendanceStatus === 'present').length;
                    const allMarked = [...slot.regulars, ...slot.catchups].every(a => a.attendanceStatus !== null);

                    return (
                        <div
                            key={slot.time}
                            className="bg-[#1a1d23] rounded-[24px] border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden"
                        >
                            {/* Slot header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[#424754]/15 bg-[#1e2230]/50">
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-[#adc6ff] font-black text-lg leading-none">
                                            {slot.timeLabel.split(' ')[0]}
                                        </p>
                                        <p className="text-[#8c909f] text-xs font-bold">
                                            {slot.timeLabel.split(' ')[1]}
                                        </p>
                                    </div>
                                    <div className="w-px h-8 bg-[#424754]/30" />
                                    <div>
                                        <p className="text-white font-semibold text-sm">
                                            Session Slot: {slot.timeLabel}
                                        </p>
                                        <p className="text-[#8c909f] text-xs">
                                            {totalCount} student{totalCount !== 1 ? 's' : ''} expected
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
                                            {presentCount}/{totalCount} marked
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Split Columns Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#424754]/15">
                                {/* Regular Register (Master List) */}
                                <div className="p-6 space-y-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-[11px] font-black text-[#8c909f] uppercase tracking-wider">Regular Register (Master List)</h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#2a2d35]/40 text-[#8c909f] border border-[#424754]/10">
                                            {slot.regulars.length} Scheduled
                                        </span>
                                    </div>
                                    
                                    {slot.regulars.length === 0 ? (
                                        <p className="text-center text-[#8c909f]/55 text-xs py-8 italic border border-dashed border-[#424754]/10 rounded-2xl">
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
                                        <p className="text-center text-[#8c909f]/55 text-xs py-8 italic border border-dashed border-[#424754]/10 rounded-2xl">
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
                    <div className="bg-[#1a1d23] border border-[#424754]/20 rounded-[28px] max-w-lg w-full overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-[#424754]/15 bg-[#1e2230]/50">
                            <div>
                                <h3 className="text-lg font-bold text-white">Register Catch-Up or Walk-In</h3>
                                <p className="text-xs text-[#8c909f]">Add a child for a one-off session</p>
                            </div>
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="p-2 rounded-xl bg-white/5 border border-[#424754]/10 text-[#8c909f] hover:text-white transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {centreId !== 'all' && (
                            /* Tabs */
                            <div className="flex border-b border-[#424754]/15 px-6 bg-[#1a1d23]">
                                <button
                                    onClick={() => setWalkInTab('existing')}
                                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
                                        walkInTab === 'existing'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-[#8c909f] hover:text-[#c2c6d6]'
                                    }`}
                                >
                                    Select Existing Student
                                </button>
                                <button
                                    onClick={() => setWalkInTab('new')}
                                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
                                        walkInTab === 'new'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-[#8c909f] hover:text-[#c2c6d6]'
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
                                                <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Search Students</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-3 w-4 h-4 text-[#8c909f]" />
                                                    <input
                                                        type="text"
                                                        value={studentSearchQuery}
                                                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                                                        placeholder="Search existing students..."
                                                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            {/* List box */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Select Student *</label>
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
                                                                <p className="text-xs text-[#8c909f] py-4 text-center border border-dashed border-[#424754]/10 rounded-2xl">
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
                                                                                ? 'bg-primary/10 border-primary text-white font-bold'
                                                                                : 'bg-white/5 border-[#424754]/10 text-slate-300 hover:bg-white/10'
                                                                        }`}
                                                                    >
                                                                        <div>
                                                                            <div>{student.firstName} {student.lastName} (Year {student.schoolYear})</div>
                                                                            <div className="text-[10px] text-[#8c909f] font-normal mt-0.5">Parent: {student.parentFirstName} {student.parentLastName} ({student.parentEmail})</div>
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
                                                <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Session Time</label>
                                                <select
                                                    value={formSessionTime}
                                                    onChange={(e) => setFormSessionTime(e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                >
                                                    {['15:45', '17:00', '11:00', '12:15', '13:30', '14:45'].map(t => (
                                                        <option key={t} value={t} className="bg-[#1a1d23] text-white">{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Child details */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Child First Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formChildFirst}
                                                        onChange={(e) => setFormChildFirst(e.target.value)}
                                                        placeholder="e.g. John"
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Child Last Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formChildLast}
                                                        onChange={(e) => setFormChildLast(e.target.value)}
                                                        placeholder="e.g. Doe"
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">School Year</label>
                                                    <select
                                                        value={formYear}
                                                        onChange={(e) => setFormYear(e.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    >
                                                        {['Nursery', 'Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(yr => (
                                                            <option key={yr} value={yr} className="bg-[#1a1d23] text-white">Year {yr}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Session Time</label>
                                                    <select
                                                        value={formSessionTime}
                                                        onChange={(e) => setFormSessionTime(e.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    >
                                                        {['15:45', '17:00', '11:00', '12:15', '13:30', '14:45'].map(t => (
                                                            <option key={t} value={t} className="bg-[#1a1d23] text-white">{t}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Parent details */}
                                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#424754]/10">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Parent First Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formParentFirst}
                                                        onChange={(e) => setFormParentFirst(e.target.value)}
                                                        placeholder="e.g. Mary"
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Parent Last Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formParentLast}
                                                        onChange={(e) => setFormParentLast(e.target.value)}
                                                        placeholder="e.g. Doe"
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Parent Email *</label>
                                                    <input
                                                        type="email"
                                                        required
                                                        value={formParentEmail}
                                                        onChange={(e) => setFormParentEmail(e.target.value)}
                                                        placeholder="e.g. mary@gmail.com"
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-[#8c909f] uppercase tracking-wider mb-1.5">Parent Phone</label>
                                                    <input
                                                        type="tel"
                                                        value={formParentPhone}
                                                        onChange={(e) => setFormParentPhone(e.target.value)}
                                                        placeholder="e.g. 07123456789"
                                                        className="w-full h-10 px-3 rounded-xl bg-[#2a2d35]/40 border border-[#424754]/25 text-white placeholder-white/20 text-xs focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#424754]/15 bg-[#1e2230]/50">
                            <button
                                onClick={() => setShowWalkIn(false)}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-[#424754]/15 text-white/70 hover:text-white text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                            {centreId !== 'all' && (
                                <button
                                    onClick={handleWalkInSubmit}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 disabled:opacity-55 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
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
