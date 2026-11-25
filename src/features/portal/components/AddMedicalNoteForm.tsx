'use client';

import { useId, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { addMedicalNote } from '@/app/portal/children/[id]/actions';
import { Plus } from 'lucide-react';

export function AddMedicalNoteForm({ childId }: { childId: string }) {
    const inputId = useId();
    const [content, setContent] = useState('');
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        const res = await addMedicalNote(childId, content);
        setIsSubmitting(false);

        if (res.success) {
            toast({ title: 'Success', message: 'Medical note added successfully', variant: 'success' });
            setContent('');
        } else {
            toast({ title: 'Error', message: res.error || 'Failed to add medical note', variant: 'error' });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            {/* A11Y-1: associate label with textarea so screen readers can announce the field */}
            <label
                htmlFor={inputId}
                className="sr-only"
            >
                Medical note
            </label>
            <textarea
                id={inputId}
                placeholder="E.g., Allergic to peanuts, needs inhaler for asthma..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                aria-label="Medical note"
                className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-foreground placeholder:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary/50 transition-colors"
                rows={3}
            />
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting || !content.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-sm font-bold text-primary-foreground hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    {isSubmitting ? 'Saving...' : 'Add Note'}
                </button>
            </div>
        </form>
    );
}
