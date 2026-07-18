'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Phone, Mail, Calendar, GraduationCap, AlertTriangle, Clock, User,
    ChevronLeft, ChevronRight, CheckCircle, XCircle, MinusCircle,
    Loader2, Edit2, Check, X, Link2, Copy, LayoutGrid, BookOpen,
    ClipboardList, CreditCard, ShieldAlert, HeartHandshake, Info,
    CheckCircle2, MapPin, Banknote,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sibling { id: string; firstName: string; lastName: string; }

interface RegistrationDetail {
    id: string;
    status: string;
    startDate: Date | null;
    sessions: string[] | null;
    fundingTypes: string[] | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelationship: string | null;
    hasSpecialNeeds: boolean | null;
    specialNeedsDetails: string | null;
    parentEmail: string | null;
    parentPhone: string | null;
    parentName: string | null;
    submittedAt: Date | null;
}

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
        parent: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; };
        bookings: Array<{
            id: string; startAt: Date; status: string; centreName: string; attendeeId: string;
            feedbackNotes: string | null; feedbackScore: string | null; feedbackStatus: string;
            feedbackAttachmentBase64: string | null; feedbackAttachmentMime: string | null;
            feedbackSentAt: Date | null; attendanceStatus: string | null; attendanceNote: string | null;
        }>;
        attendanceStats?: { total: number; completed: number };
    };
    initialNotes: Array<{
        id: string; content: string; authorName: string; userId: string | null;
        category: string; noteType: string | null; subject: string | null;
        rating: string | null; pinnedAt: Date | null; createdAt: Date;
    }>;
    currentUserId?: string;
    currentUserRole?: string;
    billingConfig?: StudentBillingConfig | null;
    siblings?: Sibling[];
    registrationDetail?: RegistrationDetail | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nameToGradient(name: string): string {
    const gradients = [
        'from-blue-500 to-violet-600', 'from-violet-500 to-fuchsia-600',
        'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600',
        'from-rose-500 to-pink-600', 'from-cyan-500 to-blue-600',
        'from-indigo-500 to-blue-600', 'from-teal-500 to-emerald-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
}

function getKsBadge(year: string | null): { label: string; colour: string } {
    if (!year) return { label: '', colour: '' };
    const map: Record<string, string> = {
        Reception: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
        Y1: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
        Y2: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
        Y3: 'bg-violet-500/10 border-violet-500/30 text-violet-600',
        Y4: 'bg-violet-500/10 border-violet-500/30 text-violet-600',
        Y5: 'bg-violet-500/10 border-violet-500/30 text-violet-600',
        Y6: 'bg-violet-500/10 border-violet-500/30 text-violet-600',
        Y7: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
        Y8: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
        Y9: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
        Y10: 'bg-orange-500/10 border-orange-500/30 text-orange-600',
        Y11: 'bg-orange-500/10 border-orange-500/30 text-orange-600',
        Y12: 'bg-rose-500/10 border-rose-500/30 text-rose-600',
        Y13: 'bg-rose-500/10 border-rose-500/30 text-rose-600',
    };
    return { label: year, colour: map[year] ?? 'bg-secondary border-border text-foreground' };
}

const FUNDING_LABELS: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    universal_credit: 'Universal Credit',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    awaiting_confirmation: { label: 'Awaiting Confirmation', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    signed_up: { label: 'Confirmed', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    not_interested: { label: 'Not Interested', cls: 'bg-muted text-muted-foreground border-border' },
    pending: { label: 'Pending', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ComponentType<{ className?: string }> }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TabId = 'overview' | 'bookings' | 'registration' | 'billing';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'bookings', label: 'Sessions', icon: BookOpen },
    { id: 'registration', label: 'Registration', icon: ClipboardList },
    { id: 'billing', label: 'Billing', icon: CreditCard },
];

export default function StudentProfile({
    student, initialNotes, currentUserId, currentUserRole,
    billingConfig, siblings = [], registrationDetail,
}: AssessmentProfileProps) {
    const fullName = `${student.firstName} ${student.lastName}`;
    const parentFullName = `${student.parent.firstName} ${student.parent.lastName}`;

    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [showPrefillModal, setShowPrefillModal] = useState(false);
    const [selectedSiblings, setSelectedSiblings] = useState<string[]>([student.id]);
    const [isEditingSchedule, setIsEditingSchedule] = useState(false);
    const [selectedSchedules, setSelectedSchedules] = useState<string[]>(student.registeredSessions || []);
    const [isPending, startTransition] = useTransition();
    const [isGeneratingLink, startLinkTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [isSavingDetails, setIsSavingDetails] = useState(false);
    const [editForm, setEditForm] = useState({
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
        schoolYear: student.schoolYear,
        notes: student.notes ?? '',
    });

    const handleSaveDetails = async () => {
        setIsSavingDetails(true);
        try {
            const res = await fetch(`/api/students/${student.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: editForm.firstName,
                    lastName: editForm.lastName,
                    dateOfBirth: editForm.dateOfBirth || null,
                    schoolYear: editForm.schoolYear,
                    notes: editForm.notes || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update');
            setIsEditingDetails(false);
            toast({ title: 'Student updated', message: 'Details saved successfully.', variant: 'success' });
            router.refresh();
        } catch (err: any) {
            toast({ title: 'Update failed', message: err.message || 'Please try again.', variant: 'error' });
        } finally {
            setIsSavingDetails(false);
        }
    };


    const generateLinkForSiblings = async (ids: string[]) => {
        if (!student.centreId) {
            toast({ title: 'No centre assigned', message: 'This student must be assigned to a centre to generate a registration link.', variant: 'error' });
            return;
        }
        startLinkTransition(async () => {
            try {
                const res = await generateRegistrationLink(student.parent.id, student.centreId!, ids);
                if (res.success && res.link) {
                    await navigator.clipboard.writeText(res.link);
                    toast({ title: 'Link copied!', message: 'Send this pre-filled registration link to the parent.', variant: 'success' });
                    setShowPrefillModal(false);
                }
            } catch (err: any) {
                toast({ title: 'Could not generate link', message: err.message || 'Please try again.', variant: 'error' });
            }
        });
    };

    const handleCopyPrefilledLink = () => {
        if (siblings && siblings.length > 1) {
            setSelectedSiblings(siblings.map(s => s.id));
            setShowPrefillModal(true);
        } else {
            generateLinkForSiblings([student.id]);
        }
    };

    const handleToggleSession = (session: string) => {
        setSelectedSchedules(prev =>
            prev.includes(session) ? prev.filter(s => s !== session) : [...prev, session]
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
        student.bookings.map(b => ({ attendanceStatus: b.attendanceStatus as AttendanceStatus | null, bookingStatus: b.status }))
    );
    const attendanceRate = attendanceBreakdown.total > 0
        ? Math.round((attendanceBreakdown.attended / attendanceBreakdown.total) * 100)
        : 0;

    const completenessFields = [
        student.firstName, student.lastName, student.dateOfBirth, student.schoolYear,
        student.parent.phone, student.parent.email, student.notes,
        student.registeredSessions && student.registeredSessions.length > 0 ? 'yes' : '',
    ];
    const completenessScore = Math.round((completenessFields.filter(Boolean).length / completenessFields.length) * 100);

    const card = 'bg-card border border-border rounded-3xl shadow-sm';
    const sL = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';
    const grad = nameToGradient(fullName);
    const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();
    const ks = getKsBadge(student.schoolYear ?? null);

    // "Create Booking" pre-selects the student's centre if available
    const createBookingHref = student.centreId
        ? `/dashboard/bookings/new?centre=${student.centreId}`
        : '/dashboard/bookings/new';

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Navigation bar ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/students"
                    className="group inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center group-hover:bg-secondary/80 transition-all">
                        <ChevronLeft className="w-4 h-4 text-foreground/60" />
                    </div>
                    Back to Students
                </Link>
                <Link
                    href={createBookingHref}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-2xl shadow-sm shadow-primary/30 transition-all active:scale-95"
                >
                    Create Booking
                </Link>
            </div>

            {/* ── Hero card ───────────────────────────────────────────────── */}
            <div className={`${card} overflow-hidden`}>
                <div className="bg-gradient-to-br from-primary/[0.08] via-violet-500/[0.05] to-transparent px-8 pt-8 pb-0">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <AttendanceRadial
                            percentage={student.attendanceStats
                                ? (Number(student.attendanceStats.completed) / (Number(student.attendanceStats.total) || 1)) * 100
                                : 0}
                            size="lg"
                        >
                            <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
                                <span className="text-2xl font-black text-white tracking-tight select-none">{initials}</span>
                            </div>
                        </AttendanceRadial>

                        <div className="text-center sm:text-left space-y-2 flex-1">
                            <h1 className="text-3xl font-black text-foreground tracking-tight">{fullName}</h1>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                {ks.label && (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${ks.colour}`}>
                                        <GraduationCap className="w-3.5 h-3.5" />
                                        {ks.label}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-semibold">
                                    <Calendar className="w-4 h-4 text-violet-500" />
                                    {student.dateOfBirth
                                        ? new Date(student.dateOfBirth).toLocaleDateString('en-GB')
                                        : 'DoB not recorded'
                                    }
                                </span>
                            </div>
                            {/* Profile completeness */}
                            <div className="flex items-center gap-3 max-w-xs mx-auto sm:mx-0 pt-1">
                                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all duration-700',
                                            completenessScore >= 80 ? 'bg-emerald-500' : completenessScore >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                                        )}
                                        style={{ width: `${completenessScore}%` }}
                                    />
                                </div>
                                <span className={cn(
                                    'text-xs font-bold',
                                    completenessScore >= 80 ? 'text-emerald-600' : completenessScore >= 50 ? 'text-amber-600' : 'text-rose-500'
                                )}>
                                    {completenessScore}% complete
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats strip */}
                    <div className="mt-8 grid grid-cols-3 border-t border-border -mx-8">
                        <div className="px-8 py-5 border-r border-border flex flex-col gap-0.5">
                            <span className={sL}>Total Sessions</span>
                            <span className="text-xl font-black text-foreground">{attendanceBreakdown.total}</span>
                        </div>
                        <Link
                            href={`/dashboard/students/${student.id}/attendance`}
                            className="px-8 py-5 border-r border-border flex flex-col gap-0.5 hover:bg-secondary/40 transition-colors"
                        >
                            <span className={sL}>Attendance Rate</span>
                            <span className={cn(
                                'text-xl font-black',
                                attendanceRate >= 80 ? 'text-emerald-600' : attendanceRate >= 60 ? 'text-amber-500' : 'text-rose-500'
                            )}>
                                {attendanceBreakdown.total > 0 ? `${attendanceRate}%` : 'N/A'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                                {attendanceBreakdown.attended} present of {attendanceBreakdown.total}
                            </span>
                        </Link>
                        <div className="px-8 py-5 flex flex-col gap-0.5">
                            <span className={sL}>Breakdown</span>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {attendanceBreakdown.attended > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                                        <CheckCircle className="w-3 h-3" />{attendanceBreakdown.attended}
                                    </span>
                                )}
                                {attendanceBreakdown.absent > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-rose-500">
                                        <XCircle className="w-3 h-3" />{attendanceBreakdown.absent} abs
                                    </span>
                                )}
                                {attendanceBreakdown.late > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                                        <Clock className="w-3 h-3" />{attendanceBreakdown.late} late
                                    </span>
                                )}
                                {attendanceBreakdown.noShow > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                        <MinusCircle className="w-3 h-3" />{attendanceBreakdown.noShow} no-show
                                    </span>
                                )}
                                {attendanceBreakdown.total === 0 && (
                                    <span className="text-xs text-muted-foreground">No sessions yet</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex bg-secondary/50 p-1 rounded-2xl border border-border gap-0.5">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold rounded-xl transition-all',
                            activeTab === id
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                        )}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab panels ──────────────────────────────────────────────── */}
            <div className={`${card} p-8`}>

                {/* Overview tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-200">

                        {/* Left column */}
                        <div className="space-y-5">

                            {/* Parent card */}
                            <div>
                                <p className={`${sL} mb-3`}>Parent / Guardian</p>
                                <div className="bg-secondary/50 border border-border rounded-2xl overflow-hidden">
                                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground text-sm">{parentFullName}</p>
                                            <p className="text-xs text-muted-foreground">Parent / Guardian</p>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-border">
                                        <a
                                            href={`tel:${student.parent.phone}`}
                                            className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Phone className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                <span className="text-sm font-semibold text-foreground">
                                                    {student.parent.phone || 'No phone recorded'}
                                                </span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                        </a>
                                        <a
                                            href={`mailto:${student.parent.email}`}
                                            className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Mail className="w-4 h-4 text-muted-foreground group-hover:text-violet-500 transition-colors" />
                                                <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                                                    {student.parent.email || 'No email recorded'}
                                                </span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-violet-400 transition-colors" />
                                        </a>
                                    </div>
                                    <div className="px-5 py-4 border-t border-border">
                                        <Link
                                            href={`/dashboard/parents/${student.parent.id}`}
                                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all"
                                        >
                                            View Family Account & Ledger
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Permanent schedule */}
                            <div className="bg-secondary/50 border border-border rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-primary" />
                                        <p className={sL}>Permanent Schedule</p>
                                    </div>
                                    {!isEditingSchedule ? (
                                        <button
                                            onClick={() => setIsEditingSchedule(true)}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => { setSelectedSchedules(student.registeredSessions || []); setIsEditingSchedule(false); }}
                                                className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveSchedule}
                                                disabled={isPending}
                                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors disabled:opacity-50"
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
                                            <p className={`${sL} mb-2`}>After-School (Mon – Fri)</p>
                                            <div className="grid grid-cols-5 gap-2">
                                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                                    <div key={day} className="space-y-1.5 p-2.5 bg-card rounded-xl border border-border">
                                                        <p className="text-[10px] font-black text-foreground truncate">{day.slice(0, 3)}</p>
                                                        {['3.45pm', '5.00pm'].map(time => {
                                                            const slot = `${day} ${time}`;
                                                            const checked = selectedSchedules.includes(slot);
                                                            return (
                                                                <label key={time} className="flex items-center gap-1.5 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => handleToggleSession(slot)}
                                                                        className="rounded border-border text-primary focus:ring-primary/30 w-3.5 h-3.5"
                                                                    />
                                                                    <span className={cn('text-[10px] font-semibold transition-colors', checked ? 'text-primary' : 'text-muted-foreground')}>
                                                                        {time}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="border-t border-border pt-3">
                                            <p className={`${sL} mb-2`}>Weekends (Sat – Sun)</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['Saturday', 'Sunday'].map(day => (
                                                    <div key={day} className="space-y-1.5 p-2.5 bg-card rounded-xl border border-border">
                                                        <p className="text-[10px] font-black text-foreground">{day}</p>
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
                                                                            className="rounded border-border text-primary focus:ring-primary/30 w-3 h-3"
                                                                        />
                                                                        <span className={cn('text-[10px] font-semibold', checked ? 'text-primary' : 'text-muted-foreground')}>
                                                                            {time}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : student.registeredSessions && student.registeredSessions.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {student.registeredSessions.map((s, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground font-medium">
                                        No sessions assigned yet. Click Edit to add days.
                                    </p>
                                )}
                            </div>

                            {/* Medical notes */}
                            {student.notes && (
                                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Medical & Safety Notes</p>
                                    </div>
                                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 leading-relaxed">
                                        {student.notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right column — details editor + progress notes */}
                        <div className="space-y-5">

                            {/* Student Details (editable) */}
                            <div className="bg-secondary/50 border border-border rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-primary" />
                                        <p className={sL}>Student Details</p>
                                    </div>
                                    {!isEditingDetails ? (
                                        <button
                                            onClick={() => setIsEditingDetails(true)}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setIsEditingDetails(false)}
                                                className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveDetails}
                                                disabled={isSavingDetails}
                                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors disabled:opacity-50"
                                            >
                                                {isSavingDetails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditingDetails ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">First Name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.firstName}
                                                    onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Last Name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.lastName}
                                                    onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Date of Birth</label>
                                                <input
                                                    type="date"
                                                    value={editForm.dateOfBirth}
                                                    onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">School Year</label>
                                                <select
                                                    value={editForm.schoolYear}
                                                    onChange={e => setEditForm(f => ({ ...f, schoolYear: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                >
                                                    {['Reception','Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8'].map(y => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Medical / Safety Notes</label>
                                            <textarea
                                                value={editForm.notes}
                                                rows={3}
                                                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Allergies, medical conditions, safeguarding notes…"
                                                className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between py-2 border-b border-border">
                                            <span className="text-xs text-muted-foreground font-semibold">Full Name</span>
                                            <span className="text-sm font-bold text-foreground">{student.firstName} {student.lastName}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-border">
                                            <span className="text-xs text-muted-foreground font-semibold">Date of Birth</span>
                                            <span className="text-sm font-bold text-foreground">
                                                {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-xs text-muted-foreground font-semibold">School Year</span>
                                            <span className="text-sm font-bold text-foreground">{student.schoolYear}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className={`${sL} mb-3`}>Progress & Notes</p>
                                <div className="space-y-4">
                                    <ProgressNoteForm childId={student.id} childName={student.firstName} />
                                    <ProgressTimeline notes={initialNotes as any} currentUserId={currentUserId} currentUserRole={currentUserRole} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sessions tab */}
                {activeTab === 'bookings' && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                        <div className="bg-secondary/50 border border-border rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className={sL}>Session History</p>
                                <Link
                                    href={`/dashboard/students/${student.id}/attendance`}
                                    className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                                >
                                    View full history →
                                </Link>
                            </div>
                            {student.bookings.length > 0 ? (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-0.5">
                                    {student.bookings.map(booking => {
                                        const resolved = resolveAttendanceStatus(
                                            (booking.attendanceStatus as AttendanceStatus | null) ?? null,
                                            booking.status
                                        );
                                        return (
                                            <div key={booking.id} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-foreground">
                                                        {new Date(booking.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                        {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {booking.centreName}
                                                    </p>
                                                    {booking.attendanceNote && (
                                                        <p className="text-[11px] text-muted-foreground mt-1 italic truncate">{booking.attendanceNote}</p>
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
                                    <p className="text-sm text-muted-foreground">No sessions recorded for this student yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Registration tab */}
                {activeTab === 'registration' && (
                    <div className="max-w-xl mx-auto space-y-5 animate-in fade-in duration-200">

                        {/* Header */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary">
                                <Link2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground text-sm">Registration & Onboarding</h3>
                                <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                                    {student.registrationId
                                        ? 'A registration form has been submitted for this child.'
                                        : 'Share a secure pre-filled registration link with the parent.'}
                                </p>
                            </div>
                        </div>

                        {student.registrationId && registrationDetail ? (
                            <>
                                {/* Status badge */}
                                <div className="flex items-center justify-between">
                                    <div className={cn(
                                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold',
                                        STATUS_CONFIG[registrationDetail.status]?.cls ?? 'bg-secondary border-border text-foreground'
                                    )}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {STATUS_CONFIG[registrationDetail.status]?.label ?? registrationDetail.status}
                                    </div>
                                    {registrationDetail.submittedAt && (
                                        <span className="text-xs text-muted-foreground">
                                            Submitted {new Date(registrationDetail.submittedAt).toLocaleDateString('en-GB')}
                                        </span>
                                    )}
                                </div>

                                {/* Registration details */}
                                <div className="bg-secondary/50 border border-border rounded-2xl overflow-hidden">
                                    <div className="px-5 py-4 border-b border-border">
                                        <p className={sL}>Registration Details</p>
                                    </div>
                                    <div className="px-5 divide-y divide-border">
                                        <InfoRow label="Start Date" value={registrationDetail.startDate ? new Date(registrationDetail.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null} icon={Calendar} />
                                        <InfoRow label="School Year" value={student.schoolYear} icon={GraduationCap} />
                                        {registrationDetail.sessions && registrationDetail.sessions.length > 0 && (
                                            <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                                                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Requested Sessions</p>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {registrationDetail.sessions.map((s, i) => (
                                                            <span key={i} className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold">{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {registrationDetail.fundingTypes && registrationDetail.fundingTypes.length > 0 && (
                                            <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                                                <Banknote className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Funding</p>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {registrationDetail.fundingTypes.map((f, i) => (
                                                            <span key={i} className="px-2 py-1 bg-secondary text-foreground border border-border rounded-lg text-xs font-semibold">
                                                                {FUNDING_LABELS[f] ?? f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Emergency contact */}
                                {registrationDetail.emergencyContactName && (
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl overflow-hidden">
                                        <div className="px-5 py-4 border-b border-amber-500/10 flex items-center gap-2">
                                            <HeartHandshake className="w-4 h-4 text-amber-600" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-500">Emergency Contact</p>
                                        </div>
                                        <div className="px-5 divide-y divide-amber-500/10">
                                            <InfoRow label="Name" value={registrationDetail.emergencyContactName} icon={User} />
                                            <InfoRow label="Phone" value={registrationDetail.emergencyContactPhone} icon={Phone} />
                                            <InfoRow label="Relationship" value={registrationDetail.emergencyContactRelationship} icon={Info} />
                                        </div>
                                    </div>
                                )}

                                {/* Special needs */}
                                {registrationDetail.hasSpecialNeeds && (
                                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Additional Needs Declared</p>
                                        </div>
                                        {registrationDetail.specialNeedsDetails && (
                                            <p className="text-sm text-rose-700 dark:text-rose-400 font-semibold leading-relaxed">
                                                {registrationDetail.specialNeedsDetails}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* View full form link */}
                                <Link
                                    href={`/dashboard/registrations/${registrationDetail.id}`}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-card border border-border hover:bg-secondary text-foreground text-xs font-bold rounded-xl transition-all"
                                >
                                    View Full Form Submission
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            </>
                        ) : student.registrationId ? (
                            // Has ID but detail failed to load
                            <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                                    <Check className="w-4 h-4 text-emerald-600" /> Registration Form Submitted
                                </div>
                                <Link
                                    href={`/dashboard/registrations/${student.registrationId}`}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-card border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-secondary text-xs font-bold rounded-xl transition-all"
                                >
                                    View Form Submission <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        ) : (
                            // No registration yet
                            <div className="bg-secondary/50 border border-border rounded-2xl p-5 space-y-4">
                                <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
                                    No registration form has been submitted for this child yet. You can share a prefilled link
                                    containing parent and sibling details from their bookings.
                                </p>
                                <button
                                    onClick={handleCopyPrefilledLink}
                                    disabled={isGeneratingLink}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
                                >
                                    {isGeneratingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                                    {isGeneratingLink ? 'Generating Link…' : 'Generate & Copy Prefilled Link'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Billing tab */}
                {activeTab === 'billing' && (
                    <div className="max-w-xl mx-auto animate-in fade-in duration-200">
                        <BillingSettingsCard
                            childId={student.id}
                            parentId={student.parent.id}
                            centreId={(student as any).centreId ?? ''}
                            orgId={(student as any).organisationId ?? ''}
                            siblings={siblings}
                            existingConfig={billingConfig ?? null}
                        />
                    </div>
                )}
            </div>

            {/* ── Prefill modal ────────────────────────────────────────────── */}
            {showPrefillModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card rounded-3xl border border-border shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-foreground tracking-tight">Prefilled Registration Link</h3>
                            <button
                                onClick={() => setShowPrefillModal(false)}
                                className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary/80 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
                            Select the siblings to include in this prefilled registration link.
                            Common details like parent contact and address will be shared to avoid duplication.
                        </p>
                        <div className="space-y-2.5">
                            <p className={sL}>Select Children</p>
                            <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-secondary/50">
                                {siblings.map(sib => {
                                    const checked = selectedSiblings.includes(sib.id);
                                    return (
                                        <label key={sib.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => setSelectedSiblings(prev =>
                                                    checked ? prev.filter(id => id !== sib.id) : [...prev, sib.id]
                                                )}
                                                className="rounded border-border text-primary focus:ring-primary/30 w-4 h-4"
                                            />
                                            <span className="text-sm font-semibold text-foreground">
                                                {sib.firstName} {sib.lastName}
                                                {sib.id === student.id && (
                                                    <span className="text-xs text-muted-foreground font-normal ml-1">(current)</span>
                                                )}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowPrefillModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-secondary text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => generateLinkForSiblings(selectedSiblings)}
                                disabled={selectedSiblings.length === 0 || isGeneratingLink}
                                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                                {isGeneratingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                                {isGeneratingLink ? 'Generating...' : 'Copy Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
