'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw, Trash2, Loader2 } from 'lucide-react';
import { restoreParent, hardDeleteParent } from '@/app/dashboard/parents/bin.actions';
import { Button } from '@/components/ui/Button';

interface Props {
    parentId: string;
    parentName: string;
}

export default function BinActions({ parentId, parentName }: Props) {
    const [showRestore, setShowRestore] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRestore = async () => {
        setIsLoading(true);
        try {
            await restoreParent(parentId);
            router.refresh();
        } finally {
            setIsLoading(false);
            setShowRestore(false);
        }
    };

    const handleHardDelete = async () => {
        setIsLoading(true);
        try {
            await hardDeleteParent(parentId);
            router.refresh();
        } finally {
            setIsLoading(false);
            setShowDelete(false);
        }
    };

    return (
        <div className="flex items-center justify-end gap-1">
            <button
                onClick={() => setShowRestore(true)}
                className="px-2.5 py-1.5 text-accent hover:bg-accent-soft text-xs font-medium rounded-sm inline-flex items-center gap-1.5 transition-colors"
            >
                <RefreshCcw className="w-3.5 h-3.5" /> Restore
            </button>
            <button
                onClick={() => setShowDelete(true)}
                className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-soft rounded-sm transition-colors"
                title="Delete forever"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Restore confirmation */}
            {showRestore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full">
                        <div className="w-11 h-11 bg-accent-soft rounded-md flex items-center justify-center mb-4">
                            <RefreshCcw className="w-5 h-5 text-accent" />
                        </div>
                        <h3 className="text-section-title text-text mb-2">Restore family?</h3>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full">
                        <div className="w-11 h-11 bg-danger-soft rounded-md flex items-center justify-center mb-4">
                            <Trash2 className="w-5 h-5 text-danger" />
                        </div>
                        <h3 className="text-section-title text-text mb-2">Permanently delete?</h3>
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
