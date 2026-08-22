'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Phone, Mail, Calendar, GraduationCap, AlertTriangle, Clock, User,
    ChevronLeft, ChevronRight, CheckCircle, XCircle, MinusCircle,
    Loader2, Edit2, Check, X, Link2, Copy, LayoutGrid, BookOpen,
    ClipboardList, CreditCard, ShieldAlert, HeartHandshake, Info,
    CheckCircle2, Banknote,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui/utils';
import ProgressNoteForm from '@/features/students/components/ProgressNoteForm';
import ProgressTimeline from '@/features/students/components/ProgressTimeline';
import { resolveAttendanceStatus, getAttendanceColorClass, countAttendance } from '@/lib/attendance';
import type { AttendanceStatus } from '@/lib/attendance';
import { updateStudentSchedule } from '@/features/students/student-actions';
import { useToast } from '@/components/ui/ToastProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import BillingSettingsCard from '@/features/billing/components/BillingSettingsCard';
import { generateRegistrationLink, updateRegistrationStatus } from '@/app/dashboard/registrations/actions';
import type { StudentBillingConfig } from '@/features/billing/queries';
import { formatDistanceToNow } from 'date-fns';

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
        sessionSlots?: string | null;
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

function getYearGroupVariant(year: string | null): 'default' | 'success' | 'warning' | 'error' {
    if (!year) return 'default';
    if (['Reception', 'Y1', 'Y2'].includes(year)) return 'default';
    if (['Y3', 'Y4', 'Y5', 'Y6'].includes(year)) return 'success';
    if (['Y7', 'Y8', 'Y9'].includes(year)) return 'warning';
    return 'error';
}

const FUNDING_LABELS: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    universal_credit: 'Universal Credit',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' }> = {
    awaiting_confirmation: { label: 'Awaiting confirmation', variant: 'warning' },
    signed_up: { label: 'Confirmed', variant: 'success' },
    not_interested: { label: 'Not interested', variant: 'default' },
    pending: { label: 'Pending', variant: 'default' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ComponentType<{ className?: string }> }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0">
            {Icon && <Icon className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />}
            <div className="min-w-0">
                <p className="text-label text-text-muted">{label}</p>
                <p className="text-small-body font-medium text-text mt-0.5">{value}</p>
            </div>
        </div>
    );
}

function SubPanel({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('rounded-md border border-border-subtle bg-page p-4', className)}>{children}</div>;
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
    const [isUpdatingStatus, startStatusTransition] = useTransition();
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
        } catch (err) {
            const message = err instanceof Error ? err.message : undefined;
            toast({ title: 'Update failed', message: message || 'Please try again.', variant: 'error' });
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
            } catch (err) {
                const message = err instanceof Error ? err.message : undefined;
                toast({ title: 'Could not generate link', message: message || 'Please try again.', variant: 'error' });
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

    const handleUpdateRegistrationStatus = (status: 'signed_up' | 'not_interested' | 'awaiting_confirmation') => {
        if (!registrationDetail) return;
        startStatusTransition(async () => {
            try {
                await updateRegistrationStatus(registrationDetail.id, status);
                toast({ title: 'Status updated', message: `Registration marked as "${STATUS_CONFIG[status]?.label ?? status}".`, variant: 'success' });
                router.refresh();
            } catch (err) {
                const message = err instanceof Error ? err.message : undefined;
                toast({ title: 'Update failed', message: message || 'Please try again.', variant: 'error' });
            }
        });
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

    const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();
    const yearVariant = getYearGroupVariant(student.schoolYear ?? null);
    const hasSafetyFlags = initialNotes.some(n => n.category === 'Medical') || initialNotes.some(n => n.category === 'Safeguarding');

    // "Create Booking" pre-selects the student's centre if available
    const createBookingHref = student.centreId
        ? `/dashboard/bookings/new?centre=${student.centreId}`
        : '/dashboard/bookings/new';

    return (
        <div className="max-w-4xl mx-auto space-y-5">

            {/* ── Navigation bar ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/students"
                    className="group inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to students
                </Link>
                <Button asChild size="sm">
                    <Link href={createBookingHref}>Create booking</Link>
                </Button>
            </div>

            {/* ── Header card ─────────────────────────────────────────────── */}
            <Card>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                        <span className="text-page-title select-none">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-page-title text-text truncate">{fullName}</h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {student.schoolYear && (
                                <Badge variant={yearVariant}>
                                    <GraduationCap className="w-3 h-3" />
                                    {student.schoolYear}
                                </Badge>
                            )}
                            <span className="text-metadata flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : 'DoB not recorded'}
                            </span>
                            {hasSafetyFlags && (
                                <Badge variant="error">
                                    <ShieldAlert className="w-3 h-3" />
                                    Safety flags
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Key metrics */}
                    <div className="flex sm:flex-col gap-2 sm:min-w-[150px]">
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata">Balance</span>
                            <span className={cn('text-small-body font-semibold', billingConfig && billingConfig.agreedMonthlyPence < 0 ? 'text-danger' : 'text-text')}>
                                {billingConfig ? `£${(billingConfig.agreedMonthlyPence / 100).toFixed(2)}/mo` : '£0.00'}
                            </span>
                        </div>
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata">30-day attendance</span>
                            <span className={cn('text-small-body font-semibold', attendanceRate < 80 && attendanceBreakdown.total > 0 ? 'text-warning' : 'text-text')}>
                                {attendanceBreakdown.total > 0 ? `${attendanceRate}%` : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex border-b border-border gap-1">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-2.5 text-small-body font-medium border-b-2 -mb-px transition-colors',
                            activeTab === id
                                ? 'border-accent text-text'
                                : 'border-transparent text-text-muted hover:text-text'
                        )}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab panels ──────────────────────────────────────────────── */}
            <Card>
                <div className="p-5 sm:p-6">

                {/* Overview tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Left column */}
                        <div className="space-y-4">

                            {/* Parent card */}
                            <div>
                                <p className="text-label text-text-muted mb-2">Parent / guardian</p>
                                <SubPanel className="p-0 overflow-hidden">
                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
                                        <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-small-body font-medium text-text">{parentFullName}</p>
                                            <p className="text-metadata">Parent / guardian</p>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-border-subtle">
                                        <a
                                            href={`tel:${student.parent.phone}`}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors group"
                                        >
                                            <span className="flex items-center gap-2.5 text-small-body font-medium text-text">
                                                <Phone className="w-3.5 h-3.5 text-text-muted" />
                                                {student.parent.phone || 'No phone recorded'}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                                        </a>
                                        <a
                                            href={`mailto:${student.parent.email}`}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors group"
                                        >
                                            <span className="flex items-center gap-2.5 text-small-body font-medium text-text truncate">
                                                <Mail className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                                                {student.parent.email || 'No email recorded'}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors flex-shrink-0" />
                                        </a>
                                    </div>
                                    <div className="p-3 border-t border-border-subtle">
                                        <Button asChild variant="secondary" size="sm" className="w-full">
                                            <Link href={`/dashboard/parents/${student.parent.id}`}>
                                                View family account &amp; ledger
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </Button>
                                    </div>
                                </SubPanel>
                            </div>

                            {/* Permanent schedule */}
                            <SubPanel>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-label text-text-muted">Permanent schedule</p>
                                    {!isEditingSchedule ? (
                                        <button
                                            onClick={() => setIsEditingSchedule(true)}
                                            className="inline-flex items-center gap-1 text-metadata font-medium text-accent hover:text-accent-hover transition-colors"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => { setSelectedSchedules(student.registeredSessions || []); setIsEditingSchedule(false); }}
                                                className="inline-flex items-center gap-1 text-metadata font-medium text-text-muted hover:text-text transition-colors"
                                            >
                                                <X className="w-3 h-3" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveSchedule}
                                                disabled={isPending}
                                                className="inline-flex items-center gap-1 text-metadata font-medium text-success hover:opacity-80 transition-colors disabled:opacity-50"
                                            >
                                                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditingSchedule ? (
                                    <div className="space-y-3">
                                        {student.sessionSlots ? (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                {(() => {
                                                    let slots = [];
                                                    try {
                                                        slots = JSON.parse(student.sessionSlots);
                                                    } catch (e) {}
                                                    return slots.map((slot: string) => {
                                                        const checked = selectedSchedules.includes(slot);
                                                        return (
                                                            <label key={slot} className="flex items-center gap-2 p-2.5 bg-surface rounded-sm border border-border cursor-pointer hover:border-accent/40 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => handleToggleSession(slot)}
                                                                    className="rounded-sm border-border text-accent focus:ring-accent/30 w-4 h-4"
                                                                />
                                                                <span className={cn('text-metadata font-medium', checked ? 'text-accent' : 'text-text')}>
                                                                    {slot}
                                                                </span>
                                                            </label>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        ) : (
                                            <p className="text-small-body text-text-secondary italic p-3 bg-surface rounded-sm border border-border-subtle">
                                                No dynamic session configurations found. Ensure the centre has session slots configured.
                                            </p>
                                        )}
                                    </div>
                                ) : student.registeredSessions && student.registeredSessions.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {student.registeredSessions.map((s, i) => (
                                            <span key={i} className="px-2.5 py-1 bg-accent-soft text-accent rounded-sm text-xs font-medium">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-small-body text-text-secondary">
                                        No sessions assigned yet. Click Edit to add days.
                                    </p>
                                )}
                            </SubPanel>

                            {/* Medical notes */}
                            {student.notes && (
                                <div className="rounded-md border border-danger/30 bg-danger-soft p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4 text-danger" />
                                        <p className="text-label text-danger">Medical &amp; safety notes</p>
                                    </div>
                                    <p className="text-small-body text-text leading-relaxed">
                                        {student.notes}
                                    </p>
                                </div>
                            )}

                            {/* Registration status summary */}
                            {registrationDetail && (
                                <SubPanel className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <ClipboardList className="w-4 h-4 text-text-muted" />
                                        <div>
                                            <p className="text-label text-text-muted">Registration</p>
                                            <span className="inline-flex items-center gap-1 text-small-body font-medium text-text">
                                                {STATUS_CONFIG[registrationDetail.status]?.label ?? registrationDetail.status}
                                                {registrationDetail.status === 'awaiting_confirmation' && registrationDetail.submittedAt && (
                                                    <span className="text-text-muted font-normal">
                                                        — {formatDistanceToNow(new Date(registrationDetail.submittedAt), { addSuffix: true })}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('registration')}
                                        className="text-metadata font-medium text-accent hover:text-accent-hover transition-colors whitespace-nowrap"
                                    >
                                        View →
                                    </button>
                                </SubPanel>
                            )}

                            {/* Siblings */}
                            {siblings && siblings.length > 1 && (
                                <div>
                                    <p className="text-label text-text-muted mb-2">Family</p>
                                    <SubPanel className="p-0 divide-y divide-border-subtle overflow-hidden">
                                        {siblings.filter(s => s.id !== student.id).map(sib => (
                                            <Link
                                                key={sib.id}
                                                href={`/dashboard/students/${sib.id}`}
                                                className="flex items-center justify-between px-4 py-2.5 hover:bg-surface transition-colors group"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 text-[10px] font-semibold">
                                                        {sib.firstName[0]}{sib.lastName[0]}
                                                    </div>
                                                    <span className="text-small-body font-medium text-text">
                                                        {sib.firstName} {sib.lastName}
                                                    </span>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                                            </Link>
                                        ))}
                                    </SubPanel>
                                </div>
                            )}
                        </div>

                        {/* Right column — details editor + progress notes */}
                        <div className="space-y-4">

                            {/* Student Details (editable) */}
                            <SubPanel>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-label text-text-muted">Student details</p>
                                    {!isEditingDetails ? (
                                        <button
                                            onClick={() => setIsEditingDetails(true)}
                                            className="inline-flex items-center gap-1 text-metadata font-medium text-accent hover:text-accent-hover transition-colors"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setIsEditingDetails(false)}
                                                className="inline-flex items-center gap-1 text-metadata font-medium text-text-muted hover:text-text transition-colors"
                                            >
                                                <X className="w-3 h-3" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveDetails}
                                                disabled={isSavingDetails}
                                                className="inline-flex items-center gap-1 text-metadata font-medium text-success hover:opacity-80 transition-colors disabled:opacity-50"
                                            >
                                                {isSavingDetails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditingDetails ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">First name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.firstName}
                                                    onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">Last name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.lastName}
                                                    onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">Date of birth</label>
                                                <input
                                                    type="date"
                                                    value={editForm.dateOfBirth}
                                                    onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">School year</label>
                                                <select
                                                    value={editForm.schoolYear}
                                                    onChange={e => setEditForm(f => ({ ...f, schoolYear: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                >
                                                    {['Reception','Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8'].map(y => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-label text-text-muted block mb-1">Medical / safety notes</label>
                                            <textarea
                                                value={editForm.notes}
                                                rows={3}
                                                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Allergies, medical conditions, safeguarding notes…"
                                                className="w-full px-3 py-2 bg-surface border border-border rounded-sm text-small-body text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors resize-none"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-0">
                                        <div className="flex items-center justify-between py-2 border-b border-border-subtle">
                                            <span className="text-metadata">Full name</span>
                                            <span className="text-small-body font-medium text-text">{student.firstName} {student.lastName}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-border-subtle">
                                            <span className="text-metadata">Date of birth</span>
                                            <span className="text-small-body font-medium text-text">
                                                {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-metadata">School year</span>
                                            <span className="text-small-body font-medium text-text">{student.schoolYear}</span>
                                        </div>
                                    </div>
                                )}
                            </SubPanel>

                            <div>
                                <p className="text-label text-text-muted mb-2">Progress &amp; notes</p>
                                <div className="space-y-3">
                                    <ProgressNoteForm childId={student.id} childName={student.firstName} />
                                    <ProgressTimeline notes={initialNotes as any} currentUserId={currentUserId} currentUserRole={currentUserRole} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sessions tab */}
                {activeTab === 'bookings' && (
                    <div className="space-y-4">

                        {/* ── Attendance stats strip ──────────────────────── */}
                        {attendanceBreakdown.total > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Attended', value: attendanceBreakdown.attended, total: attendanceBreakdown.total, cls: 'text-success', icon: CheckCircle },
                                    { label: 'Absent', value: attendanceBreakdown.absent, total: attendanceBreakdown.total, cls: 'text-danger', icon: XCircle },
                                    { label: 'Late', value: attendanceBreakdown.late, total: attendanceBreakdown.total, cls: 'text-warning', icon: Clock },
                                    { label: 'No-show', value: attendanceBreakdown.noShow, total: attendanceBreakdown.total, cls: 'text-text-secondary', icon: MinusCircle },
                                ].map(({ label, value, total, cls, icon: Icon }) => (
                                    <SubPanel key={label} className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-label text-text-muted">{label}</span>
                                            <Icon className={cn('w-3.5 h-3.5', cls)} />
                                        </div>
                                        <span className={cn('text-financial-total', cls)}>{value}</span>
                                        <span className="text-metadata">
                                            {total > 0 ? `${Math.round((value / total) * 100)}%` : '—'} of {total}
                                        </span>
                                    </SubPanel>
                                ))}
                            </div>
                        )}

                        {/* ── Session history list ────────────────────────── */}
                        <SubPanel>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-label text-text-muted">Session history</p>
                                <Link
                                    href={`/dashboard/students/${student.id}/attendance`}
                                    className="text-metadata font-medium text-accent hover:text-accent-hover transition-colors"
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
                                            <div key={booking.id} className="p-3 rounded-sm bg-surface border border-border-subtle flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-small-body font-medium text-text">
                                                        {new Date(booking.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-metadata flex items-center gap-1 mt-0.5 truncate">
                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                        {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {booking.centreName}
                                                    </p>
                                                    {booking.attendanceNote && (
                                                        <p className="text-metadata mt-1 italic truncate">{booking.attendanceNote}</p>
                                                    )}
                                                </div>
                                                <span className={cn(
                                                    'text-xs font-medium rounded-sm px-2 py-1 flex-shrink-0 whitespace-nowrap',
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
                                    <p className="text-small-body text-text-secondary">No sessions recorded for this student yet.</p>
                                </div>
                            )}
                        </SubPanel>
                    </div>
                )}


                {/* Registration tab */}
                {activeTab === 'registration' && (
                    <div className="max-w-xl mx-auto space-y-4">

                        {/* Header */}
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-accent-soft rounded-md flex items-center justify-center text-accent flex-shrink-0">
                                <Link2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-card-heading text-text">Registration &amp; onboarding</h3>
                                <p className="text-metadata mt-0.5">
                                    {student.registrationId
                                        ? 'A registration form has been submitted for this child.'
                                        : 'Share a secure pre-filled registration link with the parent.'}
                                </p>
                            </div>
                        </div>

                        {student.registrationId && registrationDetail ? (
                            <>
                                {/* Status badge + inline actions */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Badge variant={STATUS_CONFIG[registrationDetail.status]?.variant ?? 'default'}>
                                            <CheckCircle2 className="w-3 h-3" />
                                            {STATUS_CONFIG[registrationDetail.status]?.label ?? registrationDetail.status}
                                        </Badge>
                                        {registrationDetail.submittedAt && (
                                            <span className="text-metadata">
                                                {formatDistanceToNow(new Date(registrationDetail.submittedAt), { addSuffix: true })}
                                            </span>
                                        )}
                                    </div>
                                    {/* Inline approve / reject actions */}
                                    {registrationDetail.status === 'awaiting_confirmation' && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleUpdateRegistrationStatus('signed_up')}
                                                disabled={isUpdatingStatus}
                                                className="border-success/30 text-success hover:bg-success-soft"
                                            >
                                                {isUpdatingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleUpdateRegistrationStatus('not_interested')}
                                                disabled={isUpdatingStatus}
                                                className="border-danger/30 text-danger hover:bg-danger-soft"
                                            >
                                                {isUpdatingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                                Reject
                                            </Button>
                                        </div>
                                    )}
                                    {registrationDetail.status === 'signed_up' && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleUpdateRegistrationStatus('awaiting_confirmation')}
                                            disabled={isUpdatingStatus}
                                        >
                                            Revert to pending
                                        </Button>
                                    )}
                                </div>

                                {/* Registration details */}
                                <SubPanel className="p-0 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border-subtle">
                                        <p className="text-label text-text-muted">Registration details</p>
                                    </div>
                                    <div className="px-4 divide-y divide-border-subtle">
                                        <InfoRow label="Start date" value={registrationDetail.startDate ? new Date(registrationDetail.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null} icon={Calendar} />
                                        <InfoRow label="School year" value={student.schoolYear} icon={GraduationCap} />
                                        {registrationDetail.sessions && registrationDetail.sessions.length > 0 && (
                                            <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0">
                                                <Clock className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-label text-text-muted">Requested sessions</p>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {registrationDetail.sessions.map((s, i) => (
                                                            <span key={i} className="px-2 py-1 bg-accent-soft text-accent rounded-sm text-xs font-medium">{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {registrationDetail.fundingTypes && registrationDetail.fundingTypes.length > 0 && (
                                            <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0">
                                                <Banknote className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-label text-text-muted">Funding</p>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {registrationDetail.fundingTypes.map((f, i) => (
                                                            <span key={i} className="px-2 py-1 bg-page border border-border-subtle text-text-secondary rounded-sm text-xs font-medium">
                                                                {FUNDING_LABELS[f] ?? f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </SubPanel>

                                {/* Emergency contact */}
                                {registrationDetail.emergencyContactName && (
                                    <div className="rounded-md border border-warning/30 bg-warning-soft overflow-hidden">
                                        <div className="px-4 py-3 border-b border-warning/20 flex items-center gap-2">
                                            <HeartHandshake className="w-4 h-4 text-warning" />
                                            <p className="text-label text-warning">Emergency contact</p>
                                        </div>
                                        <div className="px-4">
                                            <InfoRow label="Name" value={registrationDetail.emergencyContactName} icon={User} />
                                            <InfoRow label="Phone" value={registrationDetail.emergencyContactPhone} icon={Phone} />
                                            <InfoRow label="Relationship" value={registrationDetail.emergencyContactRelationship} icon={Info} />
                                        </div>
                                    </div>
                                )}

                                {/* Special needs */}
                                {registrationDetail.hasSpecialNeeds && (
                                    <div className="rounded-md border border-danger/30 bg-danger-soft p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldAlert className="w-4 h-4 text-danger" />
                                            <p className="text-label text-danger">Additional needs declared</p>
                                        </div>
                                        {registrationDetail.specialNeedsDetails && (
                                            <p className="text-small-body text-text leading-relaxed">
                                                {registrationDetail.specialNeedsDetails}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* View full form link */}
                                <Button asChild variant="secondary" className="w-full">
                                    <Link href={`/dashboard/registrations/${registrationDetail.id}`}>
                                        View full form submission
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                </Button>
                            </>
                        ) : student.registrationId ? (
                            // Has ID but detail failed to load
                            <div className="rounded-md border border-success/30 bg-success-soft p-4 space-y-3">
                                <div className="flex items-center gap-2 text-success font-medium text-small-body">
                                    <Check className="w-4 h-4" /> Registration form submitted
                                </div>
                                <Button asChild variant="outline" className="w-full border-success/30 text-success">
                                    <Link href={`/dashboard/registrations/${student.registrationId}`}>
                                        View form submission <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                </Button>
                            </div>
                        ) : (
                            // No registration yet
                            <SubPanel className="space-y-3">
                                <p className="text-small-body text-text-secondary leading-relaxed">
                                    No registration form has been submitted for this child yet. You can share a prefilled link
                                    containing parent and sibling details from their bookings.
                                </p>
                                <Button onClick={handleCopyPrefilledLink} disabled={isGeneratingLink} className="w-full">
                                    {isGeneratingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                                    {isGeneratingLink ? 'Generating link…' : 'Generate & copy prefilled link'}
                                </Button>
                            </SubPanel>
                        )}
                    </div>
                )}

                {/* Billing tab */}
                {activeTab === 'billing' && (
                    <div className="max-w-xl mx-auto space-y-4">
                        {/* Status banner */}
                        {billingConfig ? (
                            <SubPanel className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-label text-text-muted">Billing plan</p>
                                    <p className={cn(
                                        'text-small-body font-medium capitalize mt-0.5',
                                        billingConfig.status === 'active' ? 'text-success' :
                                        billingConfig.status === 'paused' ? 'text-warning' : 'text-text-secondary'
                                    )}>
                                        {billingConfig.status === 'active' ? 'Active' :
                                         billingConfig.status === 'paused' ? 'Paused' : 'Cancelled'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-label text-text-muted">Monthly rate</p>
                                    <p className="text-small-body font-medium text-text mt-0.5">
                                        £{(Number(billingConfig.agreedMonthlyPence ?? 0) / 100).toFixed(2)}
                                    </p>
                                </div>
                            </SubPanel>
                        ) : (
                            <div className="rounded-md border border-dashed border-border p-5 text-center space-y-2">
                                <CreditCard className="w-6 h-6 text-text-muted mx-auto" />
                                <div>
                                    <p className="text-small-body font-medium text-text">No billing plan set up</p>
                                    <p className="text-metadata mt-1">Configure a monthly billing plan below to start invoicing this family.</p>
                                </div>
                            </div>
                        )}
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
            </Card>

            {/* ── Prefill modal ────────────────────────────────────────────── */}
            {showPrefillModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-surface rounded-lg border border-border shadow-[var(--shadow-popover)] max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-section-title text-text">Prefilled registration link</h3>
                            <button
                                onClick={() => setShowPrefillModal(false)}
                                className="w-7 h-7 rounded-full hover:bg-page flex items-center justify-center text-text-muted transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-small-body text-text-secondary leading-relaxed">
                            Select the siblings to include in this prefilled registration link.
                            Common details like parent contact and address will be shared to avoid duplication.
                        </p>
                        <p className="text-metadata bg-page border border-border-subtle rounded-sm px-3 py-2">
                            Links are valid for <strong className="text-text">30 days</strong> from generation.
                        </p>
                        <div className="space-y-2">
                            <p className="text-label text-text-muted">Select children</p>
                            <div className="divide-y divide-border-subtle border border-border-subtle rounded-md overflow-hidden bg-page">
                                {siblings.map(sib => {
                                    const checked = selectedSiblings.includes(sib.id);
                                    return (
                                        <label key={sib.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => setSelectedSiblings(prev =>
                                                    checked ? prev.filter(id => id !== sib.id) : [...prev, sib.id]
                                                )}
                                                className="rounded-sm border-border text-accent focus:ring-accent/30 w-4 h-4"
                                            />
                                            <span className="text-small-body font-medium text-text">
                                                {sib.firstName} {sib.lastName}
                                                {sib.id === student.id && (
                                                    <span className="text-metadata font-normal ml-1">(current)</span>
                                                )}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowPrefillModal(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={() => generateLinkForSiblings(selectedSiblings)}
                                disabled={selectedSiblings.length === 0 || isGeneratingLink}
                            >
                                {isGeneratingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                                {isGeneratingLink ? 'Generating...' : 'Copy link'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
