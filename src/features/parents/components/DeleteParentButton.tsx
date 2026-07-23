'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { softDeleteParent } from '@/app/dashboard/parents/bin.actions';

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

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await softDeleteParent(parentId);
            router.push('/dashboard/parents');
        } catch (e) {
            logger.error('Failed to delete parent', e);
        } finally {
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <>
            {variant === 'icon' ? (
                <button
                    onClick={() => setShowConfirm(true)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all active:scale-90 duration-100"
                    title={`Delete ${parentName}`}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            ) : (
                <button
                    onClick={() => setShowConfirm(true)}
                    className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-bold rounded-xl transition-all flex items-center gap-2 active:scale-95 duration-100"
                >
                    <Trash2 className="w-4 h-4" /> Delete Family
                </button>
            )}

            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Trash2 className="w-7 h-7 text-destructive" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground text-center mb-2">Delete Family?</h3>
                        <p className="text-sm text-muted-foreground text-center mb-6">
                            This will move <strong>{parentName}</strong> and their {childCount} children to the Bin. You have 30 days to restore them before they are permanently deleted.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 border border-border rounded-2xl text-sm font-semibold text-foreground transition-all active:scale-95 duration-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 bg-destructive hover:bg-destructive/90 rounded-2xl text-sm font-bold text-destructive-foreground transition-all active:scale-95 duration-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Move to Bin'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
