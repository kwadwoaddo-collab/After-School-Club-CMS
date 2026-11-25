'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import AlertModal from '@/components/ui/AlertModal';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { useDialogFocusTrap } from '@/components/ui/useDialogFocusTrap';

interface DeleteStudentButtonProps {
    studentId: string;
    studentName: string;
    canDelete?: boolean;
    userRole?: string;
    enrolmentStatus?: string;
    today?: string;
}

const STOP_PRESETS = ['Left centre', 'Moved school', 'Schedule change', 'Finished programme'] as const;

export default function StudentActions({
    studentId,
    studentName,
    canDelete,
    userRole,
    enrolmentStatus,
    today,
}: DeleteStudentButtonProps) {
    const resolvedToday = today || new Date().toISOString().slice(0, 10);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showStopModal, setShowStopModal] = useState(false);
    const [stopDate, setStopDate] = useState(resolvedToday);
    const [stopPreset, setStopPreset] = useState('');
    const [stopNote, setStopNote] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdatingLifecycle, setIsUpdatingLifecycle] = useState(false);
    const [alertError, setAlertError] = useState<string | null>(null);
    const actionLockRef = useRef(false);
    const stopDialogRef = useRef<HTMLDivElement | null>(null);
    const deleteDialogRef = useRef<HTMLDivElement | null>(null);
    const stopTitleId = useId();
    const deleteTitleId = useId();
    const router = useRouter();
    const { toast } = useToast();

    useDialogFocusTrap(showStopModal, stopDialogRef, () => {
        if (!actionLockRef.current) setShowStopModal(false);
    });
    useDialogFocusTrap(showConfirm, deleteDialogRef, () => {
        if (!actionLockRef.current) setShowConfirm(false);
    });

    const isAllowedToDelete = canDelete !== undefined
        ? canDelete
        : userRole
            ? ['ORG_OWNER', 'MANAGER'].includes(userRole)
            : true;

    const handleDelete = async () => {
        if (actionLockRef.current || isDeleting) return;
        actionLockRef.current = true;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
            if (res.ok) {
                toast('Student deleted successfully', 'success');
                router.push('/dashboard/students');
                router.refresh();
            } else if (res.status === 403) {
                toast('Only Owners and Managers can delete student records', 'error');
                setAlertError('You do not have permission to delete student records. Only Owners and Managers can perform this action.');
            } else {
                toast('Failed to delete student — please try again', 'error');
                setAlertError('Failed to delete student. Please try again.');
            }
        } catch {
            toast('Failed to delete student — please try again', 'error');
            setAlertError('An error occurred. Please try again.');
        } finally {
            actionLockRef.current = false;
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    const handleStop = async () => {
        if (actionLockRef.current || isUpdatingLifecycle) return;
        actionLockRef.current = true;
        setIsUpdatingLifecycle(true);
        const reason = [stopPreset, stopNote.trim()].filter(Boolean).join(' — ') || 'Marked as stopped by staff';
        try {
            const res = await fetch(`/api/students/${studentId}/lifecycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'status',
                    status: 'stopped',
                    effectiveDate: stopDate || resolvedToday,
                    reason,
                }),
            });
            if (res.ok) {
                toast('Student marked as stopped', 'success');
                setShowStopModal(false);
                router.refresh();
            } else {
                const payload = await res.json().catch(() => ({}));
                const msg = payload?.error || 'Failed to mark student as stopped';
                toast(msg, 'error');
                setAlertError(msg);
            }
        } catch {
            toast('Failed to mark student as stopped — please try again', 'error');
            setAlertError('An error occurred while stopping the student. Please try again.');
        } finally {
            actionLockRef.current = false;
            setIsUpdatingLifecycle(false);
        }
    };

    const handleReactivate = async () => {
        if (actionLockRef.current || isUpdatingLifecycle) return;
        actionLockRef.current = true;
        setIsUpdatingLifecycle(true);
        try {
            const res = await fetch(`/api/students/${studentId}/lifecycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'status',
                    status: 'active',
                    effectiveDate: resolvedToday,
                    reason: 'Reactivated by staff',
                    feeReviewConfirmed: true,
                }),
            });
            if (res.ok) {
                toast('Student reactivated', 'success');
                router.refresh();
            } else {
                const payload = await res.json().catch(() => ({}));
                const msg = payload?.error || 'Failed to reactivate student';
                toast(msg, 'error');
                setAlertError(msg);
            }
        } catch {
            toast('Failed to reactivate student — please try again', 'error');
            setAlertError('An error occurred while reactivating the student. Please try again.');
        } finally {
            actionLockRef.current = false;
            setIsUpdatingLifecycle(false);
        }
    };

    return (
        <>
            {/* Stop Student Modal */}
            {showStopModal && isAllowedToDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-left"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (e.target === e.currentTarget && !isUpdatingLifecycle) setShowStopModal(false);
                    }}
                >
                    <div
                        ref={stopDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={stopTitleId}
                        tabIndex={-1}
                        className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-md w-full space-y-4"
                    >
                        <div>
                            <h3 id={stopTitleId} className="text-section-title text-text">Stop {studentName}?</h3>
                            <p className="text-small-body text-text-secondary mt-1">
                                Excludes this student from future billing cycles and registers from the stop date onward.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-text">
                                Date stopped
                                <input
                                    type="date"
                                    value={stopDate}
                                    onChange={(e) => setStopDate(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-text tabular-nums"
                                />
                            </label>
                            <div>
                                <span className="block text-xs font-medium text-text-muted mb-1.5">Quick reason (optional)</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {STOP_PRESETS.map((preset) => (
                                        <Button
                                            key={preset}
                                            type="button"
                                            size="sm"
                                            variant={stopPreset === preset ? 'default' : 'outline'}
                                            onClick={() => setStopPreset(stopPreset === preset ? '' : preset)}
                                        >
                                            {preset}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <label className="block text-sm font-medium text-text">
                                Optional note
                                <input
                                    type="text"
                                    value={stopNote}
                                    onChange={(e) => setStopNote(e.target.value)}
                                    placeholder="Optional note…"
                                    className="mt-1 block w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-text"
                                />
                            </label>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => setShowStopModal(false)}
                                disabled={isUpdatingLifecycle}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={handleStop}
                                disabled={isUpdatingLifecycle}
                            >
                                {isUpdatingLifecycle ? <><Loader2 className="w-4 h-4 animate-spin" /> Stopping…</> : 'Confirm stopped'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirm && isAllowedToDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (e.target === e.currentTarget && !isDeleting) setShowConfirm(false);
                    }}
                >
                    <div
                        ref={deleteDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={deleteTitleId}
                        tabIndex={-1}
                        className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full"
                    >
                        <div className="w-11 h-11 bg-danger-soft rounded-md flex items-center justify-center mb-4">
                            <Trash2 className="w-5 h-5 text-danger" aria-hidden="true" />
                        </div>
                        <h3 id={deleteTitleId} className="text-section-title text-text mb-2">Delete student?</h3>
                        <p className="text-small-body text-text-secondary mb-6">
                            This will remove <strong className="text-text font-medium">{studentName}</strong> from the active student list.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)} disabled={isDeleting}>
                                Keep student
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Yes, delete'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {isAllowedToDelete && (
                    enrolmentStatus === 'stopped' ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingLifecycle}
                            onClick={handleReactivate}
                        >
                            {isUpdatingLifecycle ? 'Reactivating…' : 'Reactivate'}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setStopDate(resolvedToday);
                                setStopPreset('');
                                setStopNote('');
                                setShowStopModal(true);
                            }}
                        >
                            Stop
                        </Button>
                    )
                )}
                <Link
                    href={`/dashboard/students/${studentId}`}
                    className="min-h-[44px] px-3 py-1.5 text-accent hover:bg-accent-soft text-xs font-medium rounded-sm inline-flex items-center gap-1.5 transition-colors"
                >
                    Manage <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </Link>
                {isAllowedToDelete && (
                    <button
                        type="button"
                        aria-label={`Delete ${studentName}`}
                        onClick={() => setShowConfirm(true)}
                        className="min-w-[44px] min-h-[44px] p-2 inline-flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger-soft rounded-sm transition-colors"
                        title={`Delete ${studentName}`}
                    >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
            </div>
            <AlertModal
                isOpen={!!alertError}
                onClose={() => setAlertError(null)}
                title="Error"
                description={alertError}
                variant="error"
            />
        </>
    );
}
