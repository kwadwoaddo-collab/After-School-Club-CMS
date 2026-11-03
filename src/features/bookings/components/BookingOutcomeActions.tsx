'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
    enrolmentOutcome?: BookingEnrolmentOutcome | null;
    enrolmentOutcomeReason?: string | null;
    linkedRegistrationId?: string | null;
    compact?: boolean;
    onOutcomeUpdated?: (
        outcome: BookingEnrolmentOutcome,
        reason: string | null,
        newStatus: string
    ) => void;
}

export default function BookingOutcomeActions({
    bookingId,
    status,
    enrolmentOutcome: initialOutcome = null,
    enrolmentOutcomeReason: initialReason = null,
    linkedRegistrationId = null,
    compact = false,
    onOutcomeUpdated,
}: BookingOutcomeActionsProps) {
    const [outcome, setOutcome] = useState<BookingEnrolmentOutcome | null>(
        initialOutcome ?? (status === 'signed_up' ? 'signed_up' : status === 'completed' ? 'awaiting_outcome' : null)
    );
    const [reason, setReason] = useState<string | null>(initialReason);
    const [isEditing, setIsEditing] = useState(false);
    const [showReasonPopover, setShowReasonPopover] = useState(false);
    const [customReason, setCustomReason] = useState('');
    const [savingOutcome, setSavingOutcome] = useState<BookingEnrolmentOutcome | null>(null);

    useEffect(() => {
        setOutcome(
            initialOutcome ?? (status === 'signed_up' ? 'signed_up' : status === 'completed' ? 'awaiting_outcome' : null)
        );
    }, [initialOutcome, status]);

    useEffect(() => {
        setReason(initialReason);
    }, [initialReason]);

    const router = useRouter();
    const { toast } = useToast();

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
            const updatedStatus = data.booking?.status ?? status;

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

    if (status === 'cancelled') {
        return <span className="text-xs text-text-muted">–</span>;
    }

    const isDecided = outcome === 'signed_up' || outcome === 'did_not_sign_up';
    const isDidNotAttendFollowUp = status === 'did_not_attend' && !isDecided;
    const reasonChips = status === 'did_not_attend' ? NO_SHOW_FOLLOW_UP_REASONS : DID_NOT_SIGN_UP_REASONS;

    if (isDecided && !isEditing) {
        return (
            <div
                className={`flex items-center gap-2 flex-wrap ${compact ? '' : 'justify-between'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 flex-wrap">
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
                    className="text-xs font-medium text-text-muted hover:text-accent underline-offset-2 hover:underline transition-colors"
                >
                    Change outcome
                </button>
            </div>
        );
    }

    return (
        <div
            className="relative inline-flex items-center gap-1.5 flex-wrap"
            onClick={(e) => e.stopPropagation()}
        >
            {isDidNotAttendFollowUp && !isEditing && (
                <Badge variant="warning">Did Not Attend · Follow Up</Badge>
            )}
            {!compact && outcome === 'awaiting_outcome' && !isDidNotAttendFollowUp && !isEditing && (
                <Badge variant="warning">Awaiting Sign-Up</Badge>
            )}

            {isDidNotAttendFollowUp && !isEditing ? (
                <Button type="button" variant="outline" size="sm" asChild>
                    <Link
                        href={`/dashboard/bookings/${bookingId}/reschedule`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        Reschedule
                    </Link>
                </Button>
            ) : (
                <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={savingOutcome !== null}
                    onClick={(e) => {
                        e.stopPropagation();
                        submitOutcome('signed_up', 'Confirmed Signed Up from assessment booking');
                    }}
                >
                    {savingOutcome === 'signed_up' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Signed Up
                </Button>
            )}

            <div className="relative inline-block">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title="Did not sign up"
                    disabled={savingOutcome !== null}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowReasonPopover((prev) => !prev);
                    }}
                >
                    {savingOutcome === 'did_not_sign_up' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <XCircle className="w-3.5 h-3.5" />
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
                                            (status === 'did_not_attend'
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
                    size="sm"
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
