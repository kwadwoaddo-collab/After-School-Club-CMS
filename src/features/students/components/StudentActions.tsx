'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import AlertModal from '@/components/ui/AlertModal';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';

interface DeleteStudentButtonProps {
    studentId: string;
    studentName: string;
}

export default function StudentActions({ studentId, studentName }: DeleteStudentButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertError, setAlertError] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
            if (res.ok) {
                toast('Student deleted successfully', 'success');
                router.push('/dashboard/students');
            } else {
                toast('Failed to delete student — please try again', 'error');
                setAlertError('Failed to delete student. Please try again.');
            }
        } catch {
            toast('Failed to delete student — please try again', 'error');
            setAlertError('An error occurred. Please try again.');
        } finally {
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <>
            {/* Confirmation Modal */}
            {showConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full">
                        <div className="w-11 h-11 bg-danger-soft rounded-md flex items-center justify-center mb-4">
                            <Trash2 className="w-5 h-5 text-danger" />
                        </div>
                        <h3 className="text-section-title text-text mb-2">Delete student?</h3>
                        <p className="text-small-body text-text-secondary mb-6">
                            This will permanently remove <strong className="text-text font-medium">{studentName}</strong> and all their notes and attendance records. This action <strong className="text-danger font-medium">cannot be undone</strong>.
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
                <Link
                    href={`/dashboard/students/${studentId}`}
                    className="px-3 py-1.5 text-accent hover:bg-accent-soft text-xs font-medium rounded-sm inline-flex items-center gap-1.5 transition-colors"
                >
                    Manage <ArrowRight className="w-3 h-3" />
                </Link>
                <button
                    onClick={() => setShowConfirm(true)}
                    className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-soft rounded-sm transition-colors"
                    title={`Delete ${studentName}`}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
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
