'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { softDeleteParent } from '@/app/dashboard/parents/bin.actions';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';

interface Props {
    parentId: string;
    parentName: string;
    childCount: number;
    variant?: 'icon' | 'button';
}

export default function DeleteParentButton({ parentId, parentName, childCount, variant = 'icon' }: Props) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await softDeleteParent(parentId);
            toast('Parent deleted successfully', 'success');
            router.push('/dashboard/parents');
        } catch (e) {
            logger.error('Failed to delete parent', e);
            toast('Failed to delete parent — please try again', 'error');
        } finally {
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <>
            {variant === 'icon' ? (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirm(true); }}
                    className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-soft rounded-sm transition-colors"
                    title={`Delete ${parentName}`}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            ) : (
                <Button variant="destructive" onClick={() => setShowConfirm(true)}>
                    <Trash2 className="w-4 h-4" /> Delete family
                </Button>
            )}

            {showConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full">
                        <div className="w-11 h-11 bg-danger-soft rounded-md flex items-center justify-center mb-4">
                            <Trash2 className="w-5 h-5 text-danger" />
                        </div>
                        <h3 className="text-section-title text-text mb-2">Delete family?</h3>
                        <p className="text-small-body text-text-secondary mb-6">
                            This will move <strong className="text-text font-medium">{parentName}</strong> and their {childCount} {childCount === 1 ? 'child' : 'children'} to the Recovery Bin. You have 30 days to restore them before they are permanently deleted.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Moving…</> : 'Move to bin'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
