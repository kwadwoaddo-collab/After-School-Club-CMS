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
    ChevronRight,
    CheckCircle,
    XCircle,
    MinusCircle,
    Loader2,
    Edit2,
    Check,
    X,
    Link2,
    Copy,
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
import BillingSettingsCard from '@/components/billing/BillingSettingsCard';
import { generateRegistrationLink } from '@/app/dashboard/registrations/actions';



import type { StudentBillingConfig } from '@/features/billing/queries';

interface Sibling { id: string; firstName: string; lastName: string; }

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
        centreId?: string | null;
        organisationId?: string | null;
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
    billingConfig?: StudentBillingConfig | null;
    siblings?: Sibling[];
}

export default function StudentProfile({ student, initialNotes, currentUserId, currentUserRole, billingConfig, siblings = [] }: AssessmentProfileProps) {

    const fullName = `${student.firstName} ${student.lastName}`;
    const parentFullName = `${student.parent.firstName} ${student.parent.lastName}`;

    const [isEditingSchedule, setIsEditingSchedule] = useState(false);
    const [selectedSchedules, setSelectedSchedules] = useState<string[]>(student.registeredSessions || []);
    const [isPending, startTransition] = useTransition();
    const [isGeneratingLink, startLinkTransition] = useTransition();
    const { toast } = useToast();

    const handleCopyPrefilledLink = () => {
        if (!student.centreId) {
            toast({ title: 'No centre assigned', message: 'This student must be assigned to a centre to generate a registration link.', variant: 'error' });
            return;
        }
        startLinkTransition(async () => {
            try {
                const res = await generateRegistrationLink(student.parent.id, student.centreId!);
                if (res.success && res.link) {
                    await navigator.clipboard.writeText(res.link);
                    toast({
                        title: 'Link copied to clipboard!',
                        message: 'Send this pre-filled registration link to the parent.',
                        variant: 'success',
                    });
                }
            } catch (err: any) {
                toast({ title: 'Could not generate link', message: err.message || 'Please try again.', variant: 'error' });
            }
        });
    };


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
                toast({ title: 'Schedule updated', message: 'Attendance days saved successfully.', variant: 'success' });
            } catch {
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

    const completenessFields = [
        student.firstName, student.lastName, student.dateOfBirth, student.schoolYear,
        student.parent.phone, student.parent.email,
        student.notes,
        student.registeredSessions && student.registeredSessions.length > 0 ? 'yes' : '',
    ];
    const completenessScore = Math.round(
        (completenessFields.filter(Boolean).length / completenessFields.length) * 100
    );

    // ── shared tokens ────────────────────────────────────────────────────────
    const card = 'bg-white border border-gray-200 rounded-3xl shadow-sm';
    const sectionLabel = 'text-[10px] font-black uppercase tracking-widest text-gray-400';

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Nav bar ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/students"
                    className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center group-hover:bg-gray-200 transition-all">
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </div>
                    Back to Students
                </Link>
                <Link
                    href={`/dashboard/bookings/new?studentId=${student.id}`}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-sm shadow-blue-200 transition-all active:scale-95"
                >
                    Create Booking
                </Link>
            </div>

            {/* ── Hero card ─────────────────────────────────────────────────── */}
            <div className={`${card} overflow-hidden`}>
                {/* Coloured banner */}
                <div className="bg-gradient-to-r from-blue-50 via-violet-50 to-white px-8 pt-8 pb-0">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        {/* Avatar / radial */}
                        <AttendanceRadial
                            percentage={student.attendanceStats
                                ? (Number(student.attendanceStats.completed) / (Number(student.attendanceStats.total) || 1)) * 100
                                : 0}
                            size="lg"
                        >
                            <div className="w-full h-full bg-white flex items-center justify-center">
                                <User className="w-14 h-14 text-gray-300" />
                            </div>
                        </AttendanceRadial>

                        {/* Name + meta */}
                        <div className="text-center sm:text-left space-y-2 flex-1">
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{fullName}</h1>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-gray-500 font-semibold">
                                <span className="flex items-center gap-1.5">
                                    <GraduationCap className="w-4 h-4 text-blue-500" />
                                    {student.schoolYear}
                                </span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-violet-500" />
                                    {student.dateOfBirth
                                        ? new Date(student.dateOfBirth).toLocaleDateString('en-GB')
                                        : 'DoB not recorded'}
                                </span>
                            </div>

                            {/* Profile completeness */}
                            <div className="flex items-center gap-3 max-w-xs mx-auto sm:mx-0 pt-1">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${
                                            completenessScore >= 80 ? 'bg-emerald-500'
                                            : completenessScore >= 50 ? 'bg-amber-400'
                                            : 'bg-red-400'
                                        }`}
                                        style={{ width: `${completenessScore}%` }}
                                    />
                                </div>
                                <span className={`text-xs font-bold ${
                                    completenessScore >= 80 ? 'text-emerald-600'
                                    : completenessScore >= 50 ? 'text-amber-600'
                                    : 'text-red-500'
                                }`}>
                                    {completenessScore}% complete
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats strip */}
                    <div className="mt-8 grid grid-cols-3 border-t border-gray-100 -mx-8">
                        <div className="px-8 py-5 border-r border-gray-100 flex flex-col gap-0.5">
                            <span className={sectionLabel}>Total Sessions</span>
                            <span className="text-xl font-black text-gray-900">{attendanceBreakdown.total}</span>
                        </div>
                        <Link
                            href={`/dashboard/students/${student.id}/attendance`}
                            className="px-8 py-5 border-r border-gray-100 flex flex-col gap-0.5 hover:bg-gray-50 transition-colors group"
                        >
                            <span className={sectionLabel}>Attendance Rate</span>
                            <span className={cn('text-xl font-black',
                                attendanceRate >= 80 ? 'text-emerald-600'
                                : attendanceRate >= 60 ? 'text-amber-500'
                                : 'text-red-500'
                            )}>
                                {attendanceBreakdown.total > 0 ? `${attendanceRate}%` : 'N/A'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                                {attendanceBreakdown.attended} present of {attendanceBreakdown.total}
                            </span>
                        </Link>
                        <div className="px-8 py-5 flex flex-col gap-0.5">
                            <span className={sectionLabel}>Breakdown</span>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {attendanceBreakdown.attended > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                                        <CheckCircle className="w-3 h-3" />{attendanceBreakdown.attended}
                                    </span>
                                )}
                                {attendanceBreakdown.absent > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-red-500">
                                        <XCircle className="w-3 h-3" />{attendanceBreakdown.absent} abs
                                    </span>
                                )}
                                {attendanceBreakdown.late > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                                        <Clock className="w-3 h-3" />{attendanceBreakdown.late} late
                                    </span>
                                )}
                                {attendanceBreakdown.noShow > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                                        <MinusCircle className="w-3 h-3" />{attendanceBreakdown.noShow} no-show
                                    </span>
                                )}
                                {attendanceBreakdown.total === 0 && (
                                    <span className="text-xs text-gray-400">No sessions yet</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body: two columns */}
                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* ── Left: Contact + Schedule + Medical ─────────────── */}
                    <div className="space-y-5">

                        {/* Parent info */}
                        <div>
                            <p className={`${sectionLabel} mb-3`}>Parent / Guardian</p>
                            <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{parentFullName}</p>
                                        <p className="text-xs text-gray-400">Parent / Guardian Contact</p>
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    <a
                                        href={`tel:${student.parent.phone}`}
                                        className="flex items-center justify-between px-5 py-3.5 hover:bg-blue-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                            <span className="text-sm font-semibold text-gray-700">{student.parent.phone || 'No phone recorded'}</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                                    </a>
                                    <a
                                        href={`mailto:${student.parent.email}`}
                                        className="flex items-center justify-between px-5 py-3.5 hover:bg-violet-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-4 h-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
                                            <span className="text-sm font-semibold text-gray-700 truncate max-w-[200px]">{student.parent.email || 'No email recorded'}</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors" />
                                    </a>
                                </div>
                                <div className="px-5 py-4 space-y-2 border-t border-gray-100">
                                    <Link
                                        href={`/dashboard/parents/${student.parent.id}`}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
                                    >
                                        View Family Account & Ledger
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                    {student.registrationId ? (
                                        <Link
                                            href={`/dashboard/registrations/${student.registrationId}`}
                                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                                        >
                                            View Registration Submission
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={handleCopyPrefilledLink}
                                            disabled={isGeneratingLink}
                                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-xs font-black rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {isGeneratingLink ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                            {isGeneratingLink ? 'Generating Link…' : 'Copy Prefilled Registration Link'}
                                        </button>
                                    )}

                                </div>
                            </div>
                        </div>

                        {/* Permanent Schedule */}
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <p className={sectionLabel}>Permanent Schedule</p>
                                </div>
                                {!isEditingSchedule ? (
                                    <button
                                        onClick={() => setIsEditingSchedule(true)}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => { setSelectedSchedules(student.registeredSessions || []); setIsEditingSchedule(false); }}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" /> Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveSchedule}
                                            disabled={isPending}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                            Save
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isEditingSchedule ? (
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">After-School (Mon – Fri)</p>
                                        <div className="grid grid-cols-5 gap-2">
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                                <div key={day} className="space-y-1.5 p-2.5 bg-white rounded-xl border border-gray-200">
                                                    <p className="text-[10px] font-black text-gray-700 truncate">{day.slice(0, 3)}</p>
                                                    {['3.45pm', '5.00pm'].map(time => {
                                                        const slot = `${day} ${time}`;
                                                        const checked = selectedSchedules.includes(slot);
                                                        return (
                                                            <label key={time} className="flex items-center gap-1.5 cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => handleToggleSession(slot)}
                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                                />
                                                                <span className={`text-[10px] font-semibold transition-colors ${checked ? 'text-blue-600' : 'text-gray-500'}`}>{time}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-200 pt-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Weekends (Sat – Sun)</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Saturday', 'Sunday'].map(day => (
                                                <div key={day} className="space-y-1.5 p-2.5 bg-white rounded-xl border border-gray-200">
                                                    <p className="text-[10px] font-black text-gray-700">{day}</p>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {['11.00am', '12.15pm', '1.30pm', '2.45pm'].map(time => {
                                                            const slot = `${day} ${time}`;
                                                            const checked = selectedSchedules.includes(slot);
                                                            return (
                                                                <label key={time} className="flex items-center gap-1 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => handleToggleSession(slot)}
                                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                                                    />
                                                                    <span className={`text-[10px] font-semibold ${checked ? 'text-blue-600' : 'text-gray-500'}`}>{time}</span>
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
                                student.registeredSessions && student.registeredSessions.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {student.registeredSessions.map((s, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 font-medium">No sessions assigned yet. Click Edit to add days.</p>
                                )
                            )}
                        </div>

                        {/* Medical notes */}
                        {student.notes && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Medical & Safety Notes</p>
                                </div>
                                <p className="text-sm font-semibold text-red-800 leading-relaxed">{student.notes}</p>
                            </div>
                        )}

                        {/* Billing Settings */}
                        <BillingSettingsCard
                            childId={student.id}
                            parentId={student.parent.id}
                            centreId={(student as any).centreId ?? ''}
                            orgId={(student as any).organisationId ?? ''}
                            siblings={siblings}
                            existingConfig={billingConfig ?? null}
                        />



                    </div>

                    {/* ── Right: Progress Notes + Attendance ────────────── */}
                    <div className="space-y-5">
                        <div>
                            <p className={`${sectionLabel} mb-3`}>Progress & Notes</p>
                            <div className="space-y-4">
                                <ProgressNoteForm childId={student.id} childName={student.firstName} />
                                <ProgressTimeline
                                    notes={initialNotes as any}
                                    currentUserId={currentUserId}
                                    currentUserRole={currentUserRole}
                                />
                            </div>
                        </div>

                        {/* Attendance history */}
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className={sectionLabel}>Attendance History</p>
                                <Link
                                    href={`/dashboard/students/${student.id}/attendance`}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    View full history →
                                </Link>
                            </div>

                            {student.bookings.length > 0 ? (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                                    {student.bookings.map(booking => {
                                        const resolved = resolveAttendanceStatus(
                                            (booking.attendanceStatus as AttendanceStatus | null) ?? null,
                                            booking.status
                                        );
                                        return (
                                            <div
                                                key={booking.id}
                                                className="p-3 rounded-xl bg-white border border-gray-200 flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {new Date(booking.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                        {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {booking.centreName}
                                                    </p>
                                                    {booking.attendanceNote && (
                                                        <p className="text-[11px] text-gray-400 mt-1 italic truncate">{booking.attendanceNote}</p>
                                                    )}
                                                </div>
                                                <span className={cn(
                                                    'text-[10px] font-black uppercase rounded-full px-2.5 py-1 flex-shrink-0 whitespace-nowrap',
                                                    getAttendanceColorClass(resolved.status)
                                                )}>
                                                    {resolved.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-400">No sessions recorded for this student yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
