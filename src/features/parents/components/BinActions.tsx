'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw, Trash2, Loader2 } from 'lucide-react';
import { restoreParent, hardDeleteParent } from '@/app/dashboard/parents/bin.actions';
import { Button } from '@/components/ui/Button';
import { useDialogFocusTrap } from '@/components/ui/useDialogFocusTrap';
import { useToast } from '@/components/ui/ToastProvider';

interface Props {
    parentId: string;
    parentName: string;
    canHardDelete?: boolean;
}

export default function BinActions({ parentId, parentName, canHardDelete = false }: Props) {
    const [showRestore, setShowRestore] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const actionLockRef = useRef(false);
    const restoreDialogRef = useRef<HTMLDivElement | null>(null);
    const deleteDialogRef = useRef<HTMLDivElement | null>(null);
    const restoreTitleId = useId();
    const deleteTitleId = useId();
    const router = useRouter();
    const { toast } = useToast();

    useDialogFocusTrap(showRestore, restoreDialogRef, () => {
        if (!actionLockRef.current) setShowRestore(false);
    });
    useDialogFocusTrap(showDelete, deleteDialogRef, () => {
        if (!actionLockRef.current) setShowDelete(false);
    });

    const handleRestore = async () => {
        if (actionLockRef.current || isLoading) return;
        actionLockRef.current = true;
        setIsLoading(true);
        try {
            await restoreParent(parentId);
            setShowRestore(false);
            router.refresh();
        } catch (err) {
            toast(err instanceof Error ? err.message : 'Failed to restore family', 'error');
        } finally {
            actionLockRef.current = false;
            setIsLoading(false);
        }
    };

    const handleHardDelete = async () => {
        if (actionLockRef.current || isLoading) return;
        actionLockRef.current = true;
        setIsLoading(true);
        try {
            await hardDeleteParent(parentId);
            setShowDelete(false);
            router.refresh();
        } catch (err) {
            toast(err instanceof Error ? err.message : 'Failed to delete family permanently', 'error');
        } finally {
            actionLockRef.current = false;
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-end gap-1">
            <button
                type="button"
                onClick={() => setShowRestore(true)}
                className="min-h-[44px] px-3 py-2 text-accent hover:bg-accent-soft text-xs font-medium rounded-sm inline-flex items-center gap-1.5 transition-colors"
            >
                <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" /> Restore
            </button>
            {canHardDelete && (
                <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    aria-label={`Delete ${parentName} forever`}
                    className="min-w-[44px] min-h-[44px] p-2 text-text-muted hover:text-danger hover:bg-danger-soft rounded-sm inline-flex items-center justify-center transition-colors"
                    title="Delete forever"
                >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
            )}

            {/* Restore confirmation */}
            {showRestore && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !isLoading) setShowRestore(false); }}
                >
                    <div
                        ref={restoreDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={restoreTitleId}
                        tabIndex={-1}
                        className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full"
                    >
                        <div className="w-11 h-11 bg-accent-soft rounded-md flex items-center justify-center mb-4">
                            <RefreshCcw className="w-5 h-5 text-accent" aria-hidden="true" />
                        </div>
                        <h3 id={restoreTitleId} className="text-section-title text-text mb-2">Restore family?</h3>
                        <p className="text-small-body text-text-secondary mb-6">
                            This will restore <strong className="text-text font-medium">{parentName}</strong> and their children. They will reappear in all lists and rosters.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowRestore(false)} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={handleRestore} disabled={isLoading}>
                                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Restoring…</> : 'Yes, restore'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Permanent delete confirmation */}
            {showDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !isLoading) setShowDelete(false); }}
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
                        <h3 id={deleteTitleId} className="text-section-title text-text mb-2">Permanently delete?</h3>
                        <p className="text-small-body text-text-secondary mb-6">
                            This will permanently destroy the record for <strong className="text-text font-medium">{parentName}</strong> and their children. <strong className="text-danger font-medium">This action cannot be undone.</strong>
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowDelete(false)} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={handleHardDelete} disabled={isLoading}>
                                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Delete forever'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
