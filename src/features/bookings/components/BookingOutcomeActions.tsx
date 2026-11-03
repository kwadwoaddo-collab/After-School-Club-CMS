'use client';

import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, X, XCircle, Loader2, ExternalLink, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { requiresAssessmentOutcome } from '../assessment-outcome';
import type { BookingEnrolmentOutcome } from '@/lib/services/booking-outcome-sync';

const DID_NOT_SIGN_UP_REASONS = [
    'Fee / Cost',
    'Schedule conflict',
    'Chose another provider',
    'Not ready yet',
    'No response',
] as const;

const NO_SHOW_FOLLOW_UP_REASONS = [
    'No response after follow-up',
    'Schedule conflict',
    'Fee / Cost',
    'Chose another provider',
    'Not ready yet',
] as const;

export interface BookingOutcomeActionsProps {
    bookingId: string;
    status: string;
    startAt?: Date | string | null;
    attendanceStatuses?: Array<string | null | undefined>;
    enrolmentOutcome?: BookingEnrolmentOutcome | null;
    enrolmentOutcomeReason?: string | null;
    linkedRegistrationId?: string | null;
    compact?: boolean;
    onOutcomeUpdated?: (
        outcome: BookingEnrolmentOutcome,
        reason: string | null,
        newStatus: string
    ) => void;
    onStatusUpdated?: (
        newStatus: string,
        newEnrolmentOutcome?: BookingEnrolmentOutcome | null
    ) => void;
}

export default function BookingOutcomeActions({
    bookingId,
    status,
    startAt,
    attendanceStatuses,
    enrolmentOutcome: initialOutcome = null,
    enrolmentOutcomeReason: initialReason = null,
    linkedRegistrationId = null,
    compact = false,
    onOutcomeUpdated,
    onStatusUpdated,
}: BookingOutcomeActionsProps) {
    const [currentStatus, setCurrentStatus] = useState<string>(status);
    const [outcome, setOutcome] = useState<BookingEnrolmentOutcome | null>(
        initialOutcome ?? (status === 'signed_up' ? 'signed_up' : status === 'completed' ? 'awaiting_outcome' : null)
    );
    const [reason, setReason] = useState<string | null>(initialReason);
    const [isEditing, setIsEditing] = useState(false);
    const [showReasonPopover, setShowReasonPopover] = useState(false);
    const [customReason, setCustomReason] = useState('');
    const [savingOutcome, setSavingOutcome] = useState<BookingEnrolmentOutcome | null>(null);
    const [savingAttendance, setSavingAttendance] = useState<'completed' | 'did_not_attend' | null>(null);

    useEffect(() => {
        setCurrentStatus(status);
        setOutcome(
            initialOutcome ?? (status === 'signed_up' ? 'signed_up' : status === 'completed' ? 'awaiting_outcome' : null)
        );
    }, [initialOutcome, status]);

    useEffect(() => {
        setReason(initialReason);
    }, [initialReason]);

    const router = useRouter();
    const { toast } = useToast();

    const submitAttendanceStatus = async (targetStatus: 'completed' | 'did_not_attend') => {
        setSavingAttendance(targetStatus);
        try {
            const res = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to update attendance status');
            }

            const data = await res.json().catch(() => ({}));
            const nextOutcome: BookingEnrolmentOutcome | null =
                data?.booking && 'enrolmentOutcome' in data.booking
                    ? (data.booking.enrolmentOutcome as BookingEnrolmentOutcome | null)
                    : targetStatus === 'completed'
                    ? 'awaiting_outcome'
                    : null;

            setCurrentStatus(targetStatus);
            setOutcome(nextOutcome);
            onStatusUpdated?.(targetStatus, nextOutcome);

            toast(
                targetStatus === 'completed'
                    ? 'Attendance recorded — now record whether the student signed up.'
                    : 'Marked as Did Not Attend — placed in follow-up queue.',
                'success'
            );
            router.refresh();
        } catch (err) {
            toast(
                err instanceof Error ? err.message : 'Failed to update attendance status.',
                'error'
            );
        } finally {
            setSavingAttendance(null);
        }
    };

    const submitOutcome = async (
        targetOutcome: BookingEnrolmentOutcome,
        selectedReason?: string | null
    ) => {
        setSavingOutcome(targetOutcome);
        try {
            const res = await fetch(`/api/bookings/${bookingId}/outcome`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enrolmentOutcome: targetOutcome,
                    reason: selectedReason ?? null,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to record outcome');
            }

            const data = await res.json();
            const updatedOutcome = (data.booking?.enrolmentOutcome as BookingEnrolmentOutcome) || targetOutcome;
            const updatedReason = data.booking?.enrolmentOutcomeReason ?? selectedReason ?? null;
            const updatedStatus = data.booking?.status ?? currentStatus;

            setCurrentStatus(updatedStatus);
            setOutcome(updatedOutcome);
            setReason(updatedReason);
            setIsEditing(false);
            setShowReasonPopover(false);
            setCustomReason('');

            onOutcomeUpdated?.(updatedOutcome, updatedReason, updatedStatus);

            toast(
                updatedOutcome === 'signed_up'
                    ? 'Marked as Signed Up — student enrolment confirmed.'
                    : 'Marked as Not Interested (did not sign up).',
                'success'
            );
            router.refresh();
        } catch (err) {
            toast(
                err instanceof Error ? err.message : 'Failed to update enrolment outcome.',
                'error'
            );
        } finally {
            setSavingOutcome(null);
        }
    };

    if (currentStatus === 'cancelled') {
        return <span className="text-xs text-text-muted">–</span>;
    }

    const isDecided = outcome === 'signed_up' || outcome === 'did_not_sign_up';
    const hasAllAttendanceRecorded = Boolean(
        attendanceStatuses && attendanceStatuses.length > 0 && attendanceStatuses.every(Boolean)
    );
    const allRecordedNoShow = Boolean(
        hasAllAttendanceRecorded &&
            attendanceStatuses!.every((val) => ['no_show', 'absent', 'excused'].includes(val!))
    );
    const needsAttendance = requiresAssessmentOutcome(
        currentStatus,
        startAt,
        new Date(),
        attendanceStatuses,
        outcome
    );
    const isUpcomingBooked =
        ['confirmed', 'pending', 'rescheduled'].includes(currentStatus) &&
        !needsAttendance &&
        !hasAllAttendanceRecorded &&
        !isDecided &&
        outcome !== 'awaiting_outcome';
    const isDidNotAttendFollowUp =
        (currentStatus === 'did_not_attend' ||
            (['confirmed', 'pending'].includes(currentStatus) && allRecordedNoShow)) &&
        !isDecided;
    const reasonChips = isDidNotAttendFollowUp ? NO_SHOW_FOLLOW_UP_REASONS : DID_NOT_SIGN_UP_REASONS;
    const btnSize = compact ? 'xs' : 'sm';

    // Stage 3 — Outcome Decided (`signed_up` or `did_not_sign_up`)
    if (isDecided && !isEditing) {
        return (
            <div
                className={`flex items-center gap-2 ${compact ? 'flex-nowrap' : 'flex-wrap justify-between'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 flex-nowrap">
                    {outcome === 'signed_up' ? (
                        <Badge variant="success">
                            <CheckCircle2 className="w-3 h-3" />
                            Signed Up
                        </Badge>
                    ) : (
                        <Badge variant="default" title={reason ? `Did not sign up — ${reason}` : 'Did not sign up'}>
                            <XCircle className="w-3 h-3" />
                            Not Interested
                        </Badge>
                    )}
                    {!compact && (reason || outcome === 'did_not_sign_up') && (
                        <span className="text-xs text-text-secondary">
                            {reason || 'Did not sign up'}
                        </span>
                    )}
                    {!compact && linkedRegistrationId && (
                        <Link
                            href={`/dashboard/registrations/${linkedRegistrationId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        >
                            Registration
                            <ExternalLink className="w-3 h-3" />
                        </Link>
                    )}
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                        setShowReasonPopover(false);
                    }}
                    className="text-xs font-medium text-text-muted hover:text-accent underline-offset-2 hover:underline transition-colors whitespace-nowrap"
                >
                    {compact ? 'Edit' : 'Change outcome'}
                </button>
            </div>
        );
    }

    // Stage 0 — Upcoming Appointment (`isUpcomingBooked`)
    if (compact && isUpcomingBooked && !isEditing) {
        return <span className="text-xs text-text-muted whitespace-nowrap">After assessment</span>;
    }

    // Stage 1 — Past Appointment Needing Attendance (`needsAttendance === true`)
    if (needsAttendance && !isEditing) {
        return (
            <div
                className="flex items-center gap-1.5 flex-nowrap"
                onClick={(e) => e.stopPropagation()}
            >
                <Button
                    type="button"
                    variant="secondary"
                    size={btnSize}
                    disabled={savingAttendance !== null}
                    onClick={(e) => {
                        e.stopPropagation();
                        submitAttendanceStatus('completed');
                    }}
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                >
                    {savingAttendance === 'completed' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <Check className="w-3 h-3" />
                    )}
                    Attended
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size={btnSize}
                    disabled={savingAttendance !== null}
                    onClick={(e) => {
                        e.stopPropagation();
                        submitAttendanceStatus('did_not_attend');
                    }}
                >
                    {savingAttendance === 'did_not_attend' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <X className="w-3 h-3" />
                    )}
                    Did Not Attend
                </Button>
            </div>
        );
    }

    // Stage 2A (Attended & Awaiting Sign-Up Decision) & Stage 2B (Did Not Attend · Follow Up)
    return (
        <div
            className={`relative flex items-center gap-1.5 ${compact ? 'flex-nowrap' : 'flex-wrap'}`}
            onClick={(e) => e.stopPropagation()}
        >
            {!compact && isDidNotAttendFollowUp && !isEditing && (
                <Badge variant="warning">Did Not Attend · Follow Up</Badge>
            )}
            {!compact && outcome === 'awaiting_outcome' && !isDidNotAttendFollowUp && !isEditing && (
                <Badge variant="warning">Awaiting Sign-Up</Badge>
            )}

            {isDidNotAttendFollowUp && !isEditing ? (
                <Button type="button" variant="outline" size={btnSize} asChild>
                    <Link
                        href={`/dashboard/bookings/${bookingId}/reschedule`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <RotateCcw className="w-3 h-3" />
                        Reschedule
                    </Link>
                </Button>
            ) : (
                <Button
                    type="button"
                    variant={compact ? 'secondary' : 'default'}
                    size={btnSize}
                    disabled={savingOutcome !== null}
                    onClick={(e) => {
                        e.stopPropagation();
                        submitOutcome('signed_up', 'Confirmed Signed Up from assessment booking');
                    }}
                    className={
                        compact
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                            : ''
                    }
                >
                    {savingOutcome === 'signed_up' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <Check className="w-3 h-3" />
                    )}
                    Signed Up
                </Button>
            )}

            <div className="relative inline-block">
                <Button
                    type="button"
                    variant="outline"
                    size={btnSize}
                    title="Did not sign up"
                    disabled={savingOutcome !== null}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowReasonPopover((prev) => !prev);
                    }}
                >
                    {savingOutcome === 'did_not_sign_up' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <X className="w-3 h-3" />
                    )}
                    Not Interested
                </Button>

                {showReasonPopover && (
                    <div
                        className="absolute right-0 top-full mt-1.5 w-64 p-3 rounded-md bg-surface border border-border shadow-[var(--shadow-popover)] z-50 space-y-2.5 text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-text">Mark Not Interested</p>
                                <p className="text-[11px] text-text-muted">Did not sign up — select reason</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowReasonPopover(false)}
                                className="text-xs text-text-muted hover:text-text"
                            >
                                Close
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {reasonChips.map((chip) => (
                                <button
                                    key={chip}
                                    type="button"
                                    disabled={savingOutcome !== null}
                                    onClick={() => submitOutcome('did_not_sign_up', chip)}
                                    className="px-2 py-1 rounded-sm text-xs font-medium bg-page border border-border text-text-secondary hover:text-text hover:border-accent transition-colors"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>

                        <div className="pt-1 border-t border-border-subtle space-y-2">
                            <input
                                type="text"
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder="Optional note…"
                                aria-label="Reason for not signing up"
                                className="w-full h-8 px-2.5 rounded-sm text-xs text-text placeholder:text-text-muted border border-border bg-page focus:outline focus:outline-2 focus:outline-accent"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="w-full"
                                disabled={savingOutcome !== null}
                                onClick={() =>
                                    submitOutcome(
                                        'did_not_sign_up',
                                        customReason.trim() ||
                                            (isDidNotAttendFollowUp
                                                ? 'Did not attend — not proceeding after follow-up'
                                                : 'Did not sign up after assessment')
                                    )
                                }
                            >
                                Confirm Not Interested
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {isEditing && (
                <Button
                    type="button"
                    variant="ghost"
                    size={btnSize}
                    onClick={() => {
                        setIsEditing(false);
                        setShowReasonPopover(false);
                    }}
                >
                    Cancel
                </Button>
            )}
        </div>
    );
}
