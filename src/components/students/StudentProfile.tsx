'use client';

import { useState, useTransition } from 'react';
import {
    Phone,
    Mail,
    Calendar,
    GraduationCap,
    AlertTriangle,
    Clock,
    User,
    ChevronLeft,
    CheckCircle,
    XCircle,
    MinusCircle,
    Loader2,
    Edit2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui/utils';
import InternalNotesTimeline from '@/components/students/InternalNotesTimeline';
import ProgressNoteForm from '@/components/students/ProgressNoteForm';
import ProgressTimeline from '@/components/students/ProgressTimeline';
import { AttendanceRadial } from '@/components/ui/AttendanceRadial';
import { resolveAttendanceStatus, getAttendanceColorClass, countAttendance } from '@/lib/attendance';
import type { AttendanceStatus } from '@/lib/attendance';
import { updateStudentSchedule } from '@/features/students/student-actions';
import { useToast } from '@/components/ui/ToastProvider';

interface AssessmentProfileProps {
    student: {
        id: string;
        firstName: string;
        lastName: string;
        dateOfBirth: Date | null;
        schoolYear: string;
        notes: string | null;
        registeredSessions?: string[] | null;
        registrationId?: string | null;
        parent: {
            id: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            email: string | null;
        };
        bookings: Array<{
            id: string;
            startAt: Date;
            status: string;
            centreName: string;
            attendeeId: string;
            feedbackNotes: string | null;
            feedbackScore: string | null;
            feedbackStatus: string;
            feedbackAttachmentBase64: string | null;
            feedbackAttachmentMime: string | null;
            feedbackSentAt: Date | null;
            attendanceStatus: string | null;
            attendanceNote: string | null;
        }>;
        attendanceStats?: { total: number; completed: number };
    };
    initialNotes: Array<{
        id: string;
        content: string;
        authorName: string;
        userId: string | null;
        category: string;
        noteType: string | null;
        subject: string | null;
        rating: string | null;
        pinnedAt: Date | null;
        createdAt: Date;
    }>;
    currentUserId?: string;
    currentUserRole?: string;
}

export default function StudentProfile({ student, initialNotes, currentUserId, currentUserRole }: AssessmentProfileProps) {
    const fullName = `${student.firstName} ${student.lastName}`;
    const parentFullName = `${student.parent.firstName} ${student.parent.lastName}`;

    const [isEditingSchedule, setIsEditingSchedule] = useState(false);
    const [selectedSchedules, setSelectedSchedules] = useState<string[]>(student.registeredSessions || []);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleToggleSession = (session: string) => {
        setSelectedSchedules(prev => 
            prev.includes(session)
                ? prev.filter(s => s !== session)
                : [...prev, session]
        );
    };

    const handleSaveSchedule = () => {
        startTransition(async () => {
            try {
                await updateStudentSchedule(student.id, selectedSchedules);
                setIsEditingSchedule(false);
            } catch (err: any) {
                toast({ title: 'Could not update schedule', message: 'Please try again.', variant: 'error' });
            }
        });
    };

    const attendanceBreakdown = countAttendance(
        student.bookings.map(b => ({
            attendanceStatus: b.attendanceStatus as AttendanceStatus | null,
            bookingStatus: b.status,
        }))
    );
    const attendanceRate = attendanceBreakdown.total > 0
        ? Math.round((attendanceBreakdown.attended / attendanceBreakdown.total) * 100)
        : 0;

    // Profile completeness calculation
    const completenessFields = [
        student.firstName, student.lastName, student.dateOfBirth, student.schoolYear,
        student.parent.phone, student.parent.email,
        student.notes,
        student.registeredSessions && student.registeredSessions.length > 0 ? 'yes' : '',
    ];
    const completenessScore = Math.round(
        (completenessFields.filter(Boolean).length / completenessFields.length) * 100
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard/students" className="group flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors">
                    <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center group-hover:border-outline-variant/50 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold">Back to Students</span>
                </Link>
                <div className="flex gap-3">
                    <Link
                        href={`/dashboard/bookings/new?studentId=${student.id}`}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
                    >
                        Create Booking
                    </Link>
                </div>
            </div>

            {/* Assessment Card Detail */}
            <div className="glassmorphic-card rounded-[48px] overflow-hidden">
                {/* Visual Header */}
                <div className="bg-gradient-to-r from-primary/10 via-violet-500/10 to-transparent p-12 pb-0">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <AttendanceRadial 
                            percentage={student.attendanceStats ? (Number(student.attendanceStats.completed) / (Number(student.attendanceStats.total) || 1)) * 100 : 0} 
                            size="lg"
                        >
                            <div className="w-full h-full bg-[#19191b]/40 flex items-center justify-center relative group">
                                <User className="w-16 h-16 text-outline-variant group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </AttendanceRadial>
                        <div className="text-center md:text-left space-y-2 flex-1 w-full">
                            <div className="flex items-center justify-center md:justify-start gap-3">
                                <h1 className="text-4xl font-black text-white tracking-tight">{fullName}</h1>
                            </div>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-on-surface-variant">
                                <span className="flex items-center gap-1.5 font-bold text-sm">
                                    <GraduationCap className="w-4 h-4 text-primary" />
                                    {student.schoolYear}
                                </span>
                                <span className="w-1 h-1 bg-outline-variant/40 rounded-full" />
                                <span className="flex items-center gap-1.5 font-bold text-sm">
                                    <Calendar className="w-4 h-4 text-violet-500" />
                                    Born: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'}
                                </span>
                            </div>
                            {/* Profile Completeness */}
                            <div className="mt-4 flex items-center gap-3 max-w-xs mx-auto md:mx-0">
                                <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden border border-outline-variant/10">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${completenessScore >= 80 ? 'bg-emerald-400' : completenessScore >= 50 ? 'bg-amber-400' : 'bg-error'}`}
                                        style={{ width: `${completenessScore}%` }}
                                    />
                                </div>
                                <span className={`text-xs font-bold ${completenessScore >= 80 ? 'text-emerald-400' : completenessScore >= 50 ? 'text-amber-400' : 'text-error'}`}>
                                    {completenessScore}% complete
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* General Stats Bar */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 border-t border-outline-variant/10">
                        <div className="p-8 border-b md:border-b-0 md:border-r border-outline-variant/10 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Sessions</span>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="text-lg font-black text-white">
                                    {attendanceBreakdown.total}
                                </span>
                            </div>
                        </div>
                        <Link
                            href={`/dashboard/students/${student.id}/attendance`}
                            className="p-8 border-b md:border-b-0 md:border-r border-outline-variant/10 flex flex-col gap-1 items-center md:items-start hover:bg-white/5 transition-colors"
                        >
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Attendance Rate</span>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-emerald-400" />
                                <span className={cn("text-lg font-black", attendanceRate >= 80 ? 'text-emerald-400' : attendanceRate >= 60 ? 'text-amber-400' : 'text-error')}>
                                    {attendanceBreakdown.total > 0 ? `${attendanceRate}%` : 'N/A'}
                                </span>
                            </div>
                            <span className="text-[10px] text-on-surface-variant/60 font-medium mt-0.5">{attendanceBreakdown.attended} present of {attendanceBreakdown.total} sessions</span>
                        </Link>
                        <div className="p-8 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Breakdown</span>
                            <div className="flex items-center gap-3 flex-wrap">
                                {attendanceBreakdown.attended > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                                        <CheckCircle className="w-3 h-3" />{attendanceBreakdown.attended}
                                    </span>
                                )}
                                {attendanceBreakdown.absent > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-error">
                                        <XCircle className="w-3 h-3" />{attendanceBreakdown.absent} abs
                                    </span>
                                )}
                                {attendanceBreakdown.late > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                                        <Clock className="w-3 h-3" />{attendanceBreakdown.late} late
                                    </span>
                                )}
                                {attendanceBreakdown.noShow > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-error/70">
                                        <MinusCircle className="w-3 h-3" />{attendanceBreakdown.noShow} no-show
                                    </span>
                                )}
                                {attendanceBreakdown.pending > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-primary">
                                        <Clock className="w-3 h-3" />{attendanceBreakdown.pending} upcoming
                                    </span>
                                )}
                                {attendanceBreakdown.total === 0 && (
                                    <span className="text-xs text-on-surface-variant">No sessions yet</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-12 pt-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left Panel: Contact & Feedback Panel */}
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] mb-6">Parent Information</h3>
                            <div className="bg-[#19191b]/40 rounded-[32px] p-6 border border-outline-variant/10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-outline-variant/10 flex items-center justify-center text-on-surface-variant">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-black text-white">{parentFullName}</p>
                                        <p className="text-xs font-bold text-primary italic">Parent / Guardian Contact</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <a href={`tel:${student.parent.phone}`} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-outline-variant/10 hover:border-primary/30 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-bold text-white">{student.parent.phone || 'No phone'}</span>
                                        </div>
                                        <ChevronLeft className="w-4 h-4 text-outline-variant rotate-180" />
                                    </a>
                                    <a href={`mailto:${student.parent.email}`} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-outline-variant/10 hover:border-violet-500/30 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-bold text-white truncate max-w-[180px]">{student.parent.email || 'No email'}</span>
                                        </div>
                                        <ChevronLeft className="w-4 h-4 text-outline-variant rotate-180" />
                                    </a>
                                </div>
                                <Link 
                                    href={`/dashboard/parents/${student.parent.id}`}
                                    className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest text-[10px] hover:bg-primary/10 hover:border-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all"
                                >
                                    View Family Account & Ledger →
                                </Link>
                                {student.registrationId && (
                                    <Link 
                                        href={`/dashboard/registrations/${student.registrationId}`}
                                        className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-secondary/35 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] hover:bg-[#b884ff]/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                                    >
                                        View Registration Submission →
                                    </Link>
                                )}
                            </div>
                        </div>
 
                        {/* Selected Sessions Card */}
                        <div className="bg-[#19191b]/40 rounded-[32px] p-6 border border-outline-variant/10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-primary" />
                                    <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Permanent Schedule</h3>
                                </div>
                                {!isEditingSchedule ? (
                                    <button
                                        onClick={() => setIsEditingSchedule(true)}
                                        className="text-xs font-bold text-primary hover:text-blue-400 transition-colors flex items-center gap-1"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setSelectedSchedules(student.registeredSessions || []);
                                                setIsEditingSchedule(false);
                                            }}
                                            className="text-xs font-bold text-on-surface-variant hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveSchedule}
                                            disabled={isPending}
                                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                                        >
                                            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                            Save
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {isEditingSchedule ? (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider">After-School (Mon - Fri)</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                                                <div key={day} className="space-y-2 p-3 bg-white/5 rounded-2xl border border-outline-variant/10">
                                                    <p className="text-xs font-black text-white">{day}</p>
                                                    {['3.45pm', '5.00pm'].map((time) => {
                                                        const slot = `${day} ${time}`;
                                                        const isChecked = selectedSchedules.includes(slot);
                                                        return (
                                                            <label key={time} className="flex items-center gap-2 cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => handleToggleSession(slot)}
                                                                    className="rounded bg-[#19191b]/40 border-outline-variant/20 text-primary focus:ring-0 w-3.5 h-3.5"
                                                                />
                                                                <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-white transition-colors">{time}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2 border-t border-outline-variant/10">
                                        <h4 className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider">Weekends (Sat - Sun)</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['Saturday', 'Sunday'].map((day) => (
                                                <div key={day} className="space-y-2 p-3 bg-white/5 rounded-2xl border border-outline-variant/10">
                                                    <p className="text-xs font-black text-white">{day}</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['11.00am', '12.15pm', '1.30pm', '2.45pm'].map((time) => {
                                                            const slot = `${day} ${time}`;
                                                            const isChecked = selectedSchedules.includes(slot);
                                                            return (
                                                                <label key={time} className="flex items-center gap-2 cursor-pointer group">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => handleToggleSession(slot)}
                                                                        className="rounded bg-[#19191b]/40 border-outline-variant/20 text-primary focus:ring-0 w-3.5 h-3.5"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-white transition-colors">{time}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {student.registeredSessions && student.registeredSessions.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {student.registeredSessions.map((session, idx) => (
                                                <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-sm font-bold">
                                                    {session}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-on-surface-variant font-medium">No preferred sessions recorded.</p>
                                    )}
                                </>
                            )}
                        </div>

                        {student.notes && (
                            <div className="bg-error/10 rounded-[32px] p-8 border border-error/20">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-error" />
                                    <h3 className="text-xs font-black text-error uppercase tracking-widest">Medical &amp; Safety Notes</h3>
                                </div>
                                <p className="text-sm font-bold text-error leading-relaxed">
                                    {student.notes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Progress Notes + Attendance */}
                    <div className="space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Progress & Notes</h3>
                            </div>

                            <div className="space-y-4">
                                <ProgressNoteForm childId={student.id} childName={student.firstName} />
                                <ProgressTimeline
                                    notes={initialNotes as any}
                                    currentUserId={currentUserId}
                                    currentUserRole={currentUserRole}
                                />
                            </div>
                        </div>

                        {/* Attendance History */}
                        <div className="bg-[#19191b]/40 rounded-[32px] p-6 border border-outline-variant/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Attendance History</h3>
                                <Link
                                    href={`/dashboard/students/${student.id}/attendance`}
                                    className="text-[10px] font-bold text-primary hover:text-blue-400 transition-colors"
                                >
                                    View full history →
                                </Link>
                            </div>

                            {student.bookings.length > 0 ? (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                                    {student.bookings.map(booking => {
                                        const resolved = resolveAttendanceStatus(
                                            (booking.attendanceStatus as AttendanceStatus | null) ?? null,
                                            booking.status
                                        );
                                        return (
                                            <div key={booking.id} className="p-3 rounded-xl bg-white/5 border border-outline-variant/10 flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-black text-white">
                                                        {new Date(booking.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                        {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {booking.centreName}
                                                    </p>
                                                    {booking.attendanceNote && (
                                                        <p className="text-[11px] text-on-surface-variant/60 mt-1 italic truncate">
                                                            {booking.attendanceNote}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase rounded-full px-2.5 py-1 flex-shrink-0",
                                                    getAttendanceColorClass(resolved.status)
                                                )}>
                                                    {resolved.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-sm text-on-surface-variant">No sessions recorded for this student.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

