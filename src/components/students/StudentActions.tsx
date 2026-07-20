'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import AlertModal from '../ui/AlertModal';

interface DeleteStudentButtonProps {
    studentId: string;
    studentName: string;
}

export default function StudentActions({ studentId, studentName }: DeleteStudentButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertError, setAlertError] = useState<string | null>(null);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
            if (res.ok) {
                router.push('/dashboard/students');
            } else {
                setAlertError('Failed to delete student. Please try again.');
            }
        } catch {
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-outline-variant/20 rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Trash2 className="w-7 h-7 text-destructive" />
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-2">Delete Student?</h3>
                        <p className="text-sm text-on-surface-variant text-center mb-6">
                            This will permanently remove <strong className="text-white">{studentName}</strong> and all their notes and attendance records. This action <strong className="text-destructive">cannot be undone</strong>.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 bg-secondary/40 hover:bg-card border border-outline-variant/20 rounded-2xl text-sm font-semibold text-on-surface transition-all"
                            >
                                Keep Student
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 bg-error hover:bg-error/80 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <Link
                    href={`/dashboard/students/${studentId}`}
                    className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-lg inline-flex items-center gap-2 transition-all"
                >
                    Manage <ArrowRight className="w-3 h-3" />
                </Link>
                <button
                    onClick={() => setShowConfirm(true)}
                    className="p-2 text-on-surface-variant hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                    title={`Delete ${studentName}`}
                >
                    <Trash2 className="w-4 h-4" />
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
