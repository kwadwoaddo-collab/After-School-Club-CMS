'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw, Trash2, Loader2 } from 'lucide-react';
import { restoreParent, hardDeleteParent } from '@/app/dashboard/parents/bin.actions';

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
        <div className="flex items-center gap-2">
            <button
                onClick={() => setShowRestore(true)}
                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 active:scale-95 duration-100"
            >
                <RefreshCcw className="w-3.5 h-3.5" /> Restore
            </button>
            <button
                onClick={() => setShowDelete(true)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all active:scale-90 duration-100"
                title="Delete Forever"
            >
                <Trash2 className="w-4 h-4" />
            </button>

            {/* Restore Modal */}
            {showRestore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <RefreshCcw className="w-7 h-7 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground text-center mb-2">Restore Family?</h3>
                        <p className="text-sm text-muted-foreground text-center mb-6">
                            This will restore <strong>{parentName}</strong> and their children. They will reappear in all lists and rosters.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowRestore(false)} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-semibold transition-all active:scale-95 duration-100">Cancel</button>
                            <button onClick={handleRestore} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-sm font-bold transition-all active:scale-95 duration-100 flex items-center justify-center gap-2">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hard Delete Modal */}
            {showDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Trash2 className="w-7 h-7 text-destructive" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground text-center mb-2">Permanently Delete?</h3>
                        <p className="text-sm text-muted-foreground text-center mb-6">
                            This will permanently destroy the record for <strong>{parentName}</strong> and their children. <strong className="text-destructive">This action cannot be undone.</strong>
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDelete(false)} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-semibold transition-all active:scale-95 duration-100">Cancel</button>
                            <button onClick={handleHardDelete} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-2xl text-sm font-bold transition-all active:scale-95 duration-100 flex items-center justify-center gap-2">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
