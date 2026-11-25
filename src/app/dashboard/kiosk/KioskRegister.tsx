'use client';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useTransition, useOptimistic, useEffect, useRef } from 'react';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import { queueOfflineAction, getUnsyncedActions, markActionSynced } from '@/lib/offline-sync';
import {
    CheckCircle2, XCircle, Clock,
    Loader2, ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Users,
    Maximize2, Minimize2, RefreshCw, Stethoscope, Edit2, Sparkles, Search, Building2,
    ShieldCheck, X, UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatSchoolYearLabel } from '@/lib/school-year';

const playChime = (type: 'success' | 'error') => {
    try {
        const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();

        if (type === 'success') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            const now = ctx.currentTime;

            // High-fidelity double chime: G5 (783.99 Hz) then C6 (1046.50 Hz)
            osc.frequency.setValueAtTime(783.99, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

            osc.frequency.setValueAtTime(1046.50, now + 0.12);
            gain.gain.setValueAtTime(0.1, now + 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.start(now);
            osc.stop(now + 0.35);
        } else {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'triangle';
            const now = ctx.currentTime;

            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(110, now + 0.25);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.25);

            osc.start(now);
            osc.stop(now + 0.25);
        }
    } catch (e) {
        logger.error('Failed to play Web Audio API chime:', e);
    }
};

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'check_out' | null;

export interface AuthorisedCollectorSummary {
    id: string;
    name: string;
    relationship: string;
    phone?: string | null;
    collectionPassword?: string | null;
    notes?: string | null;
}

export interface MedicalNoteSummary {
    id: string;
    content: string;
    authorName: string;
    category?: string;
    isSafeguarding?: boolean;
    createdAt?: string | null;
}

export interface Attendee {
    id: string;
    childId: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    notes?: string | null;
    allergies?: string[] | null;
    dietaryRequirements?: string | null;
    medicalConditions?: string | null;
    medicationNotes?: string | null;
    medicalNotes?: MedicalNoteSummary[];
    authorisedCollectors?: AuthorisedCollectorSummary[];
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string | null;
    parentPhoneLast4?: string | null;
    parentEmail?: string | null;
    attendanceStatus: AttendanceStatus;
    attendanceNote: string | null;
    lateMinutes: number | null;
    checkInTime?: string | null;
    checkOutTime?: string | null;
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

function getSafeMedicalNotes(attendee: Attendee): MedicalNoteSummary[] {
    return (attendee.medicalNotes ?? []).filter(
        n => n.isSafeguarding !== true && (!n.category || n.category === 'Medical')
    );
}

function hasMedicalAlerts(attendee: Attendee): boolean {
    const allergies = (attendee.allergies ?? []).map(a => a?.trim()).filter(Boolean);
    return (
        allergies.length > 0 ||
        Boolean(attendee.dietaryRequirements?.trim()) ||
        Boolean(attendee.medicalConditions?.trim()) ||
        Boolean(attendee.medicationNotes?.trim()) ||
        Boolean(attendee.notes?.trim()) ||
        getSafeMedicalNotes(attendee).length > 0
    );
}

function hasMedicalOrCollectorInfo(attendee: Attendee): boolean {
    return hasMedicalAlerts(attendee) || (attendee.authorisedCollectors ?? []).length > 0;
}

function resolveValidPin(attendee: Attendee): string | null {
    if (attendee.parentPhoneLast4 && /^\d{4}$/.test(attendee.parentPhoneLast4)) {
        return attendee.parentPhoneLast4;
    }
    const digits = (attendee.parentPhone || '').replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : null;
}

// ── Individual student card ───────────────────────────────────────────────────
function StudentCard({
    attendee,
    dateStr,
    sessionTime,
    centreId,
    isLarge,
    onToast,
    onStatusChange,
}: {
    attendee: Attendee;
    dateStr: string;
    sessionTime: string;
    centreId: string;
    isLarge: boolean;
    onToast: ReturnType<typeof useToast>['toast'];
    onStatusChange?: (childId: string, status: AttendanceStatus, checkedOut: boolean) => void;
}) {
    const [curBookingId, setCurBookingId] = useState<string | null>(attendee.bookingId);
    const [curAttendeeId, setCurAttendeeId] = useState<string>(attendee.id);
    const [status, addOptimisticStatus] = useOptimistic<AttendanceStatus, AttendanceStatus>(
        attendee.attendanceStatus,
        (_state, newStatus) => newStatus
    );
    const [isCheckedOut, setIsCheckedOut] = useState<boolean>(!!attendee.checkOutTime);
    const [note, setNote] = useState<string>(attendee.attendanceNote || '');
    const [lateMinutes, setLateMinutes] = useState<string>(
        attendee.lateMinutes != null ? attendee.lateMinutes.toString() : ''
    );
    const [showDetails, setShowDetails] = useState(false);
    const [medicalModalOpen, setMedicalModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [flash, setFlash] = useState(false);

    // Sign-out verification state (PIN + Staff Override)
    const expectedPin = resolveValidPin(attendee);
    const hasValidPin = expectedPin !== null;

    const [pinPadOpen, setPinPadOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);
    const [showStaffOverride, setShowStaffOverride] = useState<boolean>(!hasValidPin);
    const [staffOverrideVerified, setStaffOverrideVerified] = useState<boolean>(false);
    const [collectorName, setCollectorName] = useState<string>('');
    const [overrideError, setOverrideError] = useState<string | null>(null);

    const safeAllergies = (attendee.allergies ?? []).map(a => a?.trim()).filter(Boolean) as string[];
    const dietaryRequirements = attendee.dietaryRequirements?.trim() || null;
    const medicalConditions = attendee.medicalConditions?.trim() || null;
    const medicationNotes = attendee.medicationNotes?.trim() || null;
    const generalChildNote = attendee.notes?.trim() || null;
    const safeMedicalNotes = getSafeMedicalNotes(attendee);
    const collectors = attendee.authorisedCollectors ?? [];

    const hasMedical = hasMedicalAlerts(attendee);
    const hasModalBadge = hasMedicalOrCollectorInfo(attendee);

    const closePinModal = () => {
        setPinPadOpen(false);
        setPin('');
        setPinError(null);
        setShowStaffOverride(!hasValidPin);
        setStaffOverrideVerified(false);
        setCollectorName('');
        setOverrideError(null);
    };

    const executeMark = (s: AttendanceStatus, overrideNote?: string) => {
        const next = s === 'check_out'
            ? 'check_out'
            : (status === s && !isCheckedOut ? null : s);
        if (next === 'late') setShowDetails(true);

        const nextCheckedOut = next === 'check_out';
        const effectiveStatus: AttendanceStatus = next === 'check_out' ? 'present' : next;
        setIsCheckedOut(nextCheckedOut);
        onStatusChange?.(attendee.childId, effectiveStatus, nextCheckedOut);

        const persistedNote = overrideNote !== undefined ? overrideNote : (note || null);

        startTransition(async () => {
            addOptimisticStatus(effectiveStatus);
            try {
                let res;
                if (!navigator.onLine) {
                    await queueOfflineAction({
                        childId: attendee.childId,
                        centreId,
                        type: next === 'check_out' || next === 'absent' ? 'check_out' : 'check_in',
                        timestamp: new Date().toISOString(),
                    });
                    res = { bookingId: curBookingId, attendeeId: curAttendeeId };
                } else {
                    res = await markAttendeeAttendance({
                        bookingId: curBookingId,
                        attendeeId: curAttendeeId,
                        status: next,
                        note: persistedNote,
                        lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
                        childId: attendee.childId,
                        dateStr,
                        sessionTime,
                        centreId,
                    });
                }

                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId || attendee.id);
                }
                setFlash(true);
                setTimeout(() => setFlash(false), 800);
                playChime('success');
            } catch (err) {
                // If it fails due to network while we thought we were online, queue it
                if (!navigator.onLine || (err as Error).message.includes('fetch')) {
                    await queueOfflineAction({
                        childId: attendee.childId,
                        centreId,
                        type: next === 'check_out' || next === 'absent' ? 'check_out' : 'check_in',
                        timestamp: new Date().toISOString(),
                    });
                    setFlash(true);
                    setTimeout(() => setFlash(false), 800);
                    playChime('success');
                } else {
                    playChime('error');
                    onToast({ title: 'Could not mark attendance', message: 'Please try again or refresh.', variant: 'error' });
                }
            }
        });
    };

    const mark = (s: AttendanceStatus) => {
        if (s === 'check_out') {
            if (isCheckedOut) return;
            setPin('');
            setPinError(null);
            setShowStaffOverride(!hasValidPin);
            setStaffOverrideVerified(false);
            setCollectorName('');
            setOverrideError(null);
            setPinPadOpen(true);
            return;
        }
        executeMark(s);
    };

    const handlePinDigit = (num: number) => {
        if (!hasValidPin || !expectedPin) {
            playChime('error');
            setPin('');
            setPinError('PIN matching is disabled because no valid 4-digit parent phone number is on file. Verify ID in person and use Staff Override below.');
            return;
        }
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            setPinError(null);
            if (newPin.length === 4) {
                if (newPin !== expectedPin) {
                    playChime('error');
                    setTimeout(() => {
                        setPin('');
                        setPinError('Incorrect PIN. Enter the last 4 digits of the registered parent phone number.');
                    }, 200);
                    return;
                }
                setTimeout(() => {
                    closePinModal();
                    executeMark('check_out');
                }, 200);
            }
        }
    };

    const handleStaffOverrideConfirm = () => {
        const trimmedCollector = collectorName.trim();
        if (!staffOverrideVerified) {
            setOverrideError('Confirm collector ID was verified in person.');
            return;
        }
        if (!trimmedCollector) {
            setOverrideError('Enter the collector name before signing out.');
            return;
        }
        const auditNote = [
            note.trim(),
            `Staff Override (ID verified in person): collected by ${trimmedCollector}`,
        ]
            .filter(Boolean)
            .join(' · ');

        closePinModal();
        executeMark('check_out', auditNote);
    };

    useEffect(() => {
        if (!pinPadOpen && !medicalModalOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (pinPadOpen) closePinModal();
                if (medicalModalOpen) setMedicalModalOpen(false);
                return;
            }
            if (!pinPadOpen) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }
            if (e.key === 'Backspace') {
                setPin(prev => prev.slice(0, -1));
            } else if (/^[0-9]$/.test(e.key)) {
                handlePinDigit(parseInt(e.key, 10));
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    });

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
                playChime('success');
            } catch {
                playChime('error');
                onToast({ title: 'Could not save details', message: 'Please try again.', variant: 'error' });
            }
        });
    };

    const initials = `${(attendee.firstName || '')[0] || ''}${(attendee.lastName || '')[0] || ''}`.toUpperCase() || '??';

    const statusStyle = {
        present: { ring: 'border-emerald-500/30 bg-success-soft', avatar: 'bg-success-soft text-emerald-700 dark:text-emerald-400' },
        absent:  { ring: 'border-danger/30 bg-danger-soft',        avatar: 'bg-danger-soft text-danger' },
        late:    { ring: 'border-amber-500/30 bg-warning-soft',    avatar: 'bg-warning-soft text-amber-700 dark:text-amber-400' },
        excused: { ring: 'border-blue-500/30 bg-info-soft',        avatar: 'bg-info-soft text-blue-700 dark:text-blue-400' },
        check_out: { ring: 'border-border bg-page',               avatar: 'bg-page text-text-muted' },
    };

    const style = isCheckedOut
        ? statusStyle.check_out
        : status
            ? statusStyle[status]
            : { ring: 'bg-surface border-border', avatar: 'bg-page text-text-muted' };
    const pad = isLarge ? 'p-5' : 'p-4';
    const avatarSize = isLarge ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base';
    // Note: the min-w floor is gated behind `sm:` so the action-button row (pencil +
    // In/Late/Out) can flex-shrink to fit narrow kiosk viewports (375px) instead of
    // overflowing past the card's left edge under `justify-end`; at sm+ widths the
    // original fixed touch-target width is preserved unchanged.
    const btnSize = isLarge ? 'h-16 text-sm gap-2 px-4 min-w-0 sm:min-w-[88px]' : 'h-11 text-xs gap-1.5 px-3 min-w-0 sm:min-w-[72px]';

    return (
        <div className="space-y-2">
            <div className={`rounded-lg border transition-colors ${pad} ${style.ring} ${flash ? 'scale-[0.98]' : ''} flex flex-col gap-4`}>
                {/* Top Section: Avatar and Info */}
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`${avatarSize} rounded-md flex items-center justify-center font-bold flex-shrink-0 transition-colors ${style.avatar}`}>
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : initials}
                    </div>

                    {/* Info — UK GDPR Art. 9 shoulder-surfing safe: NO raw medical/allergy/password strings inline */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-text truncate ${isLarge ? 'text-lg' : 'text-base'}`}>
                                {attendee.firstName} {attendee.lastName}
                            </p>
                            {isCheckedOut && (
                                <Badge variant="default">Checked out</Badge>
                            )}
                            {lateMinutes && parseInt(lateMinutes) > 0 && (
                                <Badge variant="warning">
                                    <Sparkles className="w-2.5 h-2.5" /> Late
                                </Badge>
                            )}
                            {hasModalBadge && (
                                <button
                                    type="button"
                                    onClick={() => setMedicalModalOpen(true)}
                                    aria-label={`Medical / Pickup Info for ${attendee.firstName} ${attendee.lastName}`}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                                        hasMedical
                                            ? 'bg-danger-soft text-danger border-danger/25 hover:opacity-90'
                                            : 'bg-info-soft text-accent border-accent/25 hover:opacity-90'
                                    }`}
                                >
                                    <Stethoscope className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span>Medical / Pickup Info</span>
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-text-muted mt-1 leading-relaxed">
                            {formatSchoolYearLabel(attendee.schoolYear)} · {attendee.parentFirstName} {attendee.parentLastName}
                            {lateMinutes && ` · Late: ${lateMinutes}m`}
                            {note && ` · "${note}"`}
                        </p>
                    </div>
                </div>

                {/* Bottom Section: Action buttons */}
                {!isPending && (
                    <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3 w-full">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            title="Add Notes/Details"
                            className={`${btnSize} rounded-md font-semibold flex items-center justify-center transition-colors border ${showDetails
                                ? 'bg-accent-soft border-accent/40 text-accent'
                                : 'bg-page border-border text-text-muted hover:text-text'
                            }`}
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        {([
                            { s: 'present' as const, icon: <CheckCircle2 className="w-4 h-4" />, label: 'In',   isActive: status === 'present' && !isCheckedOut, active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'bg-page border-border text-text-muted hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-500/30' },
                            { s: 'late'    as const, icon: <Clock className="w-4 h-4" />,        label: 'Late', isActive: status === 'late' && !isCheckedOut,    active: 'bg-amber-500 text-white border-amber-500',      inactive: 'bg-page border-border text-text-muted hover:text-amber-700 dark:hover:text-amber-400 hover:border-amber-500/30' },
                            { s: 'check_out' as const, icon: <XCircle className="w-4 h-4" />,    label: 'Out',  isActive: isCheckedOut,                          active: 'bg-danger text-on-danger border-danger',            inactive: 'bg-page border-border text-text-muted hover:text-danger hover:border-danger/30' },
                        ]).map(({ s, icon, label, isActive, active, inactive }) => (
                            <button
                                key={s}
                                onClick={() => mark(s)}
                                className={`${btnSize} border rounded-md font-semibold flex items-center justify-center transition-colors active:scale-95 flex-1 ${isActive ? active : inactive}`}
                            >
                                {icon} <span className="ml-1">{label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Note & Late Minutes Drawer */}
            {showDetails && (
                <div className="bg-page border border-border rounded-md p-4 ml-6 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="block text-label text-text-muted mb-1">Attendance Note</label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add custom notes..."
                                className="w-full h-10 px-3 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-xs focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                            />
                        </div>
                        <div className="w-full sm:w-28">
                            <label className="block text-label text-text-muted mb-1">Late Mins</label>
                            <input
                                type="number"
                                value={lateMinutes}
                                onChange={(e) => setLateMinutes(e.target.value)}
                                placeholder="Minutes"
                                min="0"
                                className="w-full h-10 px-3 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-xs focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowDetails(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={saveDetails} disabled={isPending}>
                            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                            Save Details
                        </Button>
                    </div>
                </div>
            )}

            {/* Staff-Initiated Medical & Pickup Info Modal (UK GDPR Art. 9 Shoulder-Surfing Protected) */}
            {medicalModalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`kiosk-medical-title-${attendee.id}`}
                    className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4 py-6"
                >
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-[var(--shadow-popover)] max-w-md w-full max-h-[85vh] overflow-y-auto space-y-4">
                        <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Stethoscope className="w-4 h-4 text-danger" />
                                    <h3 id={`kiosk-medical-title-${attendee.id}`} className="text-lg font-bold text-text">
                                        Medical &amp; Pickup Information
                                    </h3>
                                </div>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {attendee.firstName} {attendee.lastName} · {formatSchoolYearLabel(attendee.schoolYear)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMedicalModalOpen(false)}
                                aria-label="Close medical and pickup modal"
                                className="p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-page transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Medical & Dietary Section */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                                Health, Allergies &amp; Dietary
                            </h4>
                            {!hasMedical ? (
                                <p className="text-xs text-text-muted italic">No medical or dietary alerts recorded.</p>
                            ) : (
                                <div className="space-y-2.5 text-sm">
                                    {safeAllergies.length > 0 && (
                                        <div className="rounded-md bg-danger-soft border border-danger/20 p-3">
                                            <p className="text-xs font-bold text-danger uppercase tracking-wider mb-1">Allergies</p>
                                            <p className="text-sm font-semibold text-text">{safeAllergies.join(', ')}</p>
                                        </div>
                                    )}
                                    {dietaryRequirements && (
                                        <div className="rounded-md bg-warning-soft border border-amber-500/20 p-3">
                                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Dietary Requirements</p>
                                            <p className="text-sm text-text">{dietaryRequirements}</p>
                                        </div>
                                    )}
                                    {medicalConditions && (
                                        <div className="rounded-md bg-page border border-border p-3">
                                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Medical Conditions</p>
                                            <p className="text-sm text-text">{medicalConditions}</p>
                                        </div>
                                    )}
                                    {medicationNotes && (
                                        <div className="rounded-md bg-page border border-border p-3">
                                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Medication Notes</p>
                                            <p className="text-sm text-text">{medicationNotes}</p>
                                        </div>
                                    )}
                                    {generalChildNote && (
                                        <div className="rounded-md bg-page border border-border p-3">
                                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Care Notes</p>
                                            <p className="text-sm text-text">{generalChildNote}</p>
                                        </div>
                                    )}
                                    {safeMedicalNotes.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Medical Notes</p>
                                            {safeMedicalNotes.map(mn => (
                                                <div key={mn.id} className="rounded-md bg-danger-soft/50 border border-danger/20 p-3">
                                                    <p className="text-sm text-text">{mn.content}</p>
                                                    <p className="text-[11px] text-text-muted mt-1">Recorded by {mn.authorName}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Authorised Collectors Section */}
                        <div className="space-y-2 border-t border-border-subtle pt-3">
                            <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-accent" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                                    Authorised Collectors
                                </h4>
                            </div>
                            <div className="rounded-md bg-page border border-border p-2.5 text-xs text-text-secondary">
                                Primary Parent/Guardian: <strong className="text-text">{attendee.parentFirstName} {attendee.parentLastName}</strong>
                            </div>
                            {collectors.length === 0 ? (
                                <p className="text-xs text-text-muted italic">No additional authorised collectors listed.</p>
                            ) : (
                                <div className="space-y-2">
                                    {collectors.map(col => (
                                        <div key={col.id} className="rounded-md bg-page border border-border p-3 space-y-1 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-sm text-text">{col.name}</span>
                                                <Badge variant="info">{col.relationship}</Badge>
                                            </div>
                                            {col.phone && (
                                                <p className="text-text-secondary">Phone: {col.phone}</p>
                                            )}
                                            {col.collectionPassword && (
                                                <p className="text-text font-semibold">
                                                    Collection Password: <span className="font-mono bg-surface px-1.5 py-0.5 rounded border border-border">{col.collectionPassword}</span>
                                                </p>
                                            )}
                                            {col.notes && (
                                                <p className="text-text-muted">{col.notes}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-border-subtle">
                            <Button size="sm" variant="outline" onClick={() => setMedicalModalOpen(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sign-Out Verification Modal (PIN Pad + Authorised Collectors + Safe Staff Override) */}
            {pinPadOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`kiosk-pin-title-${attendee.id}`}
                    className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4 py-6"
                >
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-[var(--shadow-popover)] max-w-[380px] w-full max-h-[90vh] overflow-y-auto space-y-4">
                        <div>
                            <h3 id={`kiosk-pin-title-${attendee.id}`} className="text-xl font-bold mb-1 text-center text-text">
                                Confirm Check Out
                            </h3>
                            <p className="text-center text-sm text-text-secondary">
                                Signing out <strong className="text-text">{attendee.firstName} {attendee.lastName}</strong>
                            </p>
                        </div>

                        {/* Authorised Collectors surfaced directly inside Sign-Out modal */}
                        <div className="rounded-md bg-page border border-border p-3 space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                                Authorised for Pickup
                            </p>
                            <p className="text-xs text-text-secondary">
                                Primary Parent: <strong className="text-text">{attendee.parentFirstName} {attendee.parentLastName}</strong>
                            </p>
                            {collectors.length > 0 && (
                                <div className="space-y-1.5 pt-1 border-t border-border-subtle">
                                    {collectors.map(col => (
                                        <div key={col.id} className="text-xs space-y-0.5">
                                            <p className="font-semibold text-text">
                                                {col.name} <span className="text-text-muted font-normal">({col.relationship})</span>
                                            </p>
                                            {col.phone && <p className="text-text-muted">Tel: {col.phone}</p>}
                                            {col.collectionPassword && (
                                                <p className="text-text">
                                                    Password: <span className="font-mono font-semibold">{col.collectionPassword}</span>
                                                </p>
                                            )}
                                            {col.notes && <p className="text-text-muted">{col.notes}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* PIN Verification (only active when child has a valid 4-digit phone suffix) */}
                        {hasValidPin ? (
                            <div className="space-y-3">
                                <p className="text-center text-xs text-text-secondary">
                                    Enter the last 4 digits of the registered parent phone number:
                                </p>
                                {pinError && (
                                    <p className="text-xs text-danger text-center font-medium">{pinError}</p>
                                )}
                                <div className="flex justify-center gap-4 py-1">
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} className={`w-3.5 h-3.5 rounded-full transition-colors duration-200 ${pin.length > i ? 'bg-accent' : 'bg-page border border-border'}`} />
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                        <button key={num} type="button" onClick={() => handlePinDigit(num)} className="h-12 text-xl font-bold bg-page hover:bg-border-subtle rounded-md active:scale-95 transition-all text-text">{num}</button>
                                    ))}
                                    <button type="button" onClick={closePinModal} className="h-12 text-xs font-bold bg-danger-soft text-danger hover:opacity-80 rounded-md active:scale-95 transition-all">Cancel</button>
                                    <button type="button" onClick={() => handlePinDigit(0)} className="h-12 text-xl font-bold bg-page hover:bg-border-subtle rounded-md active:scale-95 transition-all text-text">0</button>
                                    <button type="button" onClick={() => setPin(prev => prev.slice(0, -1))} className="h-12 text-xs font-bold bg-warning-soft text-amber-700 dark:text-amber-400 hover:opacity-80 rounded-md active:scale-95 transition-all">Del</button>
                                </div>
                                <div className="pt-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowStaffOverride(v => !v)}
                                        className="text-xs font-semibold text-accent hover:underline"
                                    >
                                        {showStaffOverride ? 'Hide Staff Override' : 'Staff Override (Verified ID in Person)'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-md bg-warning-soft border border-amber-500/30 p-3 space-y-1">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                    No valid 4-digit parent phone number on file — PIN verification is disabled.
                                </p>
                                {pinError && (
                                    <p className="text-xs text-danger font-medium">{pinError}</p>
                                )}
                            </div>
                        )}

                        {/* Staff Override Section (mandatory when no valid phone PIN; optional toggle otherwise) */}
                        {showStaffOverride && (
                            <div className="rounded-md bg-page border border-border p-3.5 space-y-3">
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={staffOverrideVerified}
                                        onChange={e => {
                                            setStaffOverrideVerified(e.target.checked);
                                            setOverrideError(null);
                                        }}
                                        className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                                    />
                                    <span className="text-xs font-semibold text-text leading-snug">
                                        Staff Override: Collector ID Verified in Person
                                    </span>
                                </label>

                                <div>
                                    <label
                                        htmlFor={`collector-name-${attendee.id}`}
                                        className="block text-xs font-semibold text-text-muted mb-1"
                                    >
                                        Collector Full Name
                                    </label>
                                    <input
                                        id={`collector-name-${attendee.id}`}
                                        type="text"
                                        value={collectorName}
                                        onChange={e => {
                                            setCollectorName(e.target.value);
                                            setOverrideError(null);
                                        }}
                                        placeholder="e.g. Sarah Jenkins (Aunt)"
                                        className="w-full h-9 px-3 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-xs focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                                    />
                                </div>

                                {overrideError && (
                                    <p className="text-xs text-danger font-medium">{overrideError}</p>
                                )}

                                <div className="flex items-center justify-end gap-2">
                                    {!hasValidPin && (
                                        <Button type="button" size="sm" variant="outline" onClick={closePinModal}>
                                            Cancel
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleStaffOverrideConfirm}
                                        disabled={!staffOverrideVerified || !collectorName.trim()}
                                    >
                                        Confirm Sign-Out
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const KIOSK_REFRESH_INTERVAL_MS = 60_000;

export function KioskClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const clearTimers = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (intervalId !== null) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const armMinuteTimer = () => {
            clearTimers();
            const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
            timeoutId = setTimeout(() => {
                setNow(new Date());
                intervalId = setInterval(() => setNow(new Date()), 60_000);
            }, msUntilNextMinute);
        };

        armMinuteTimer();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setNow(new Date());
                armMinuteTimer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearTimers();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return (
        <div
            suppressHydrationWarning
            className="text-text font-bold text-4xl tabular-nums tracking-tight"
        >
            {format(now, 'HH:mm')}
        </div>
    );
}

// ── Main Kiosk Register ───────────────────────────────────────────────────────
export default function KioskRegister({ slots, date, dateStr, centreName, centres, activeCentreId }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [slotIdx, setSlotIdx] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const lastRefreshAtRef = useRef<number>(0);
    const [large, setLarge] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);
    const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, AttendanceStatus>>({});

    const handleStatusChange = (childId: string, newStatus: AttendanceStatus) => {
        setOptimisticStatuses(prev => ({ ...prev, [childId]: newStatus }));
    };

    const getEffectiveStatus = (a: Attendee): AttendanceStatus =>
        Object.prototype.hasOwnProperty.call(optimisticStatuses, a.childId)
            ? optimisticStatuses[a.childId]
            : a.attendanceStatus;

    // Derive a dateStr from date prop if not passed separately
    const resolvedDateStr = dateStr || new Date().toISOString().slice(0, 10);
    const activeSlot = slots.length > 0 ? slots[Math.min(slotIdx, slots.length - 1)] : null;

    // Auto-refresh every 60s when tab is visible; refresh on return if stale (>60s)
    useEffect(() => {
        lastRefreshAtRef.current = Date.now();

        const triggerRefresh = () => {
            lastRefreshAtRef.current = Date.now();
            router.refresh();
        };

        const t = setInterval(() => {
            if (document.visibilityState === 'visible') {
                triggerRefresh();
            }
        }, KIOSK_REFRESH_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (
                document.visibilityState === 'visible' &&
                Date.now() - lastRefreshAtRef.current >= KIOSK_REFRESH_INTERVAL_MS
            ) {
                triggerRefresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearInterval(t);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [router]);

    // Offline sync manager
    useEffect(() => {
        const handleOnline = async () => {
            const actions = await getUnsyncedActions();
            if (actions.length > 0) {
                toast({ title: 'You are back online!', message: `Syncing ${actions.length} offline actions...`, variant: 'info' });
                const fallbackSessionTime = activeSlot?.time || slots[0]?.time || '15:45';
                for (const action of actions) {
                    try {
                        await markAttendeeAttendance({
                            childId: action.childId,
                            centreId: action.centreId,
                            status: action.type === 'check_in' ? 'present' : 'check_out',
                            dateStr: resolvedDateStr,
                            sessionTime: fallbackSessionTime,
                        } as any);
                        await markActionSynced(action.id);
                    } catch (e) {
                        logger.error('Failed to sync action', e);
                    }
                }
                toast({ title: 'Sync complete', message: 'All offline check-ins uploaded.', variant: 'success' });
                lastRefreshAtRef.current = Date.now();
                router.refresh();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [router, toast, resolvedDateStr, activeSlot, slots]);

    // Sync fullscreen state with browser events (e.g. Esc key)
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Aggregate stats across all slots (including optimistic status updates)
    const allAttendees = slots.flatMap(s => [...s.regulars, ...s.catchups]);
    const totalCount   = allAttendees.length;
    const presentCount = allAttendees.filter(a => getEffectiveStatus(a) === 'present').length;
    const absentCount  = allAttendees.filter(a => getEffectiveStatus(a) === 'absent').length;
    const lateCount    = allAttendees.filter(a => getEffectiveStatus(a) === 'late').length;
    const unmarkedCount = allAttendees.filter(a => getEffectiveStatus(a) === null).length;
    const progressPct  = totalCount > 0 ? Math.round(((totalCount - unmarkedCount) / totalCount) * 100) : 0;

    const rawAttendees = activeSlot
        ? [...activeSlot.regulars, ...activeSlot.catchups]
        : [];

    const searchQueryClean = searchQuery.toLowerCase().trim();
    const filteredAttendees = rawAttendees.filter(a => {
        if (!searchQueryClean) return true;
        return (
            a.firstName.toLowerCase().includes(searchQueryClean) ||
            a.lastName.toLowerCase().includes(searchQueryClean) ||
            `${a.firstName} ${a.lastName}`.toLowerCase().includes(searchQueryClean) ||
            `${a.parentFirstName} ${a.parentLastName}`.toLowerCase().includes(searchQueryClean) ||
            (a.parentEmail && a.parentEmail.toLowerCase().includes(searchQueryClean)) ||
            (a.parentPhone && a.parentPhone.includes(searchQueryClean)) ||
            a.schoolYear.toLowerCase().includes(searchQueryClean)
        );
    });

    const displayAttendees = [...filteredAttendees]
        .filter(a => {
            if (!showUnmarkedOnly) return true;
            return getEffectiveStatus(a) === null;
        })
        .sort((a, b) => {
            const aUnmarked = getEffectiveStatus(a) === null;
            const bUnmarked = getEffectiveStatus(b) === null;
            const aAlert = hasMedicalAlerts(a);
            const bAlert = hasMedicalAlerts(b);

            // Tier 1 — Unmarked with medical alert (most urgent)
            if (aUnmarked && aAlert && !(bUnmarked && bAlert)) return -1;
            if (bUnmarked && bAlert && !(aUnmarked && aAlert)) return 1;

            // Tier 2 — Unmarked without alert
            if (aUnmarked && !bUnmarked) return -1;
            if (!aUnmarked && bUnmarked) return 1;

            // Tier 3 — Already marked, alphabetical
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        });

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-page -mx-4 sm:-mx-6 lg:-mx-8 -my-6 overflow-hidden">

            {/* ── TOP BAR ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border-subtle flex-shrink-0">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-text font-bold text-lg leading-tight tracking-tight">Daily Register</h1>
                        <Badge variant="info">
                            <Building2 className="w-3 h-3" />
                            {centreName}
                        </Badge>
                    </div>
                    <p className="text-text-muted text-xs mt-0.5 font-medium">{date}</p>
                </div>

                <KioskClock />

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => { lastRefreshAtRef.current = Date.now(); router.refresh(); }} aria-label="Refresh register" title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setLarge(v => !v)} aria-label="Toggle card density" title="Toggle size">
                        {large ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                    {centres.length > 1 && (
                        <select
                            value={activeCentreId}
                            onChange={e => router.push(`/dashboard/kiosk?centre=${e.target.value}`)}
                            className="h-9 bg-surface border border-border text-text text-xs font-semibold px-3 rounded-sm outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                        >
                            <option value="all">All Centres</option>
                            {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* ── STATS BAR ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-0 bg-page border-b border-border-subtle flex-shrink-0">
                {[
                    { label: 'Total',    value: totalCount,    color: 'text-text' },
                    { label: 'Present',  value: presentCount,  color: 'text-emerald-700 dark:text-emerald-400' },
                    { label: 'Late',     value: lateCount,     color: 'text-amber-700 dark:text-amber-400' },
                    { label: 'Absent',   value: absentCount,   color: 'text-danger' },
                    { label: 'Unmarked', value: unmarkedCount, color: unmarkedCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-text-muted' },
                ].map((stat, i) => (
                    <div key={stat.label} className={`flex-1 py-3 text-center ${i > 0 ? 'border-l border-border-subtle' : ''}`}>
                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest">{stat.label}</p>
                    </div>
                ))}
                <div className="flex-1 py-3 px-4 border-l border-border-subtle">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest">Done</p>
                        <p className="text-xs font-bold text-text">{progressPct}%</p>
                    </div>
                    <div className="h-1.5 bg-border-subtle rounded-full">
                        <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── SESSION SLOT TABS ──────────────────────────────────────── */}
            {slots.length > 0 && (
                <div className="flex items-center gap-2 px-6 py-3 bg-page border-b border-border-subtle overflow-x-auto flex-shrink-0">
                    {slots.map((slot, i) => {
                        const slotAll = [...slot.regulars, ...slot.catchups];
                        const slotPresent = slotAll.filter(a => getEffectiveStatus(a) === 'present' || getEffectiveStatus(a) === 'late').length;
                        const slotDone = slotAll.length > 0 && slotAll.every(a => getEffectiveStatus(a) !== null);
                        return (
                            <button key={slot.time} onClick={() => setSlotIdx(i)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold flex-shrink-0 border transition-colors ${
                                    i === slotIdx
                                        ? 'bg-accent-soft text-accent border-accent/30'
                                        : 'bg-surface border-border text-text-muted hover:text-text'
                                }`}>
                                {slotDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                                {slot.timeLabel}
                                <span className="text-[11px] opacity-60">{slotPresent}/{slotAll.length}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── SEARCH BAR ────────────────────────────────────────────── */}
            {slots.length > 0 && (
                <div className="px-6 py-2.5 bg-page border-b border-border-subtle flex items-center gap-3 flex-shrink-0">
                    {/* Search input — full width, no max-w-md */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search students by name or parent..."
                            className="w-full h-10 pl-10 pr-10 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-page"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Unmarked Only chip */}
                    <button
                        onClick={() => setShowUnmarkedOnly(v => !v)}
                        aria-pressed={showUnmarkedOnly}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                            showUnmarkedOnly
                                ? 'bg-accent text-on-accent border-accent'
                                : 'bg-surface border-border text-text-muted hover:border-accent/40'
                        }`}
                    >
                        Unmarked only
                        {showUnmarkedOnly && unmarkedCount > 0 && (
                            <span className="ml-1.5 text-on-accent/75">{unmarkedCount}</span>
                        )}
                    </button>

                    {searchQuery && (
                        <p className="text-xs text-text-muted font-medium flex-shrink-0">
                            Found {displayAttendees.length} student{displayAttendees.length === 1 ? '' : 's'}
                        </p>
                    )}
                </div>
            )}

            {/* ── STUDENT LIST ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {slots.length === 0 ? (
                    <div className="flex items-center justify-center h-full px-8">
                        <EmptyState
                            icon={<Users className="w-8 h-8" />}
                            title="No sessions today"
                            description="No children are scheduled for today. Check the correct centre is selected above."
                            action={
                                <Button asChild>
                                    <Link href="/dashboard/attendance">Go to Roll Call &rarr;</Link>
                                </Button>
                            }
                        />
                    </div>
                ) : displayAttendees.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                        {searchQuery ? 'No matching students found' : 'No students in this slot'}
                    </div>
                ) : (
                    <div className={`grid gap-4 p-6 ${large ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                        {displayAttendees.map(a => (
                            <StudentCard
                                key={a.id}
                                attendee={a}
                                dateStr={resolvedDateStr}
                                sessionTime={activeSlot!.time}
                                centreId={activeCentreId}
                                isLarge={large}
                                onToast={toast}
                                onStatusChange={handleStatusChange}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── BOTTOM NAV ───────────────────────────────────────────── */}
            {slots.length > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-surface flex-shrink-0">
                    <Button variant="outline" onClick={() => setSlotIdx(i => Math.max(0, i - 1))} disabled={slotIdx === 0}>
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <p className="text-text-muted text-sm">Slot {slotIdx + 1} of {slots.length}</p>
                    <Button variant="outline" onClick={() => setSlotIdx(i => Math.min(slots.length - 1, i + 1))} disabled={slotIdx === slots.length - 1}>
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
