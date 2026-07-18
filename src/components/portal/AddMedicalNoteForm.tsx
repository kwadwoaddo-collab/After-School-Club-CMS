'use client';

import { useState } from 'react';
import { addMedicalNote } from '@/app/portal/children/[id]/actions';
import { Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function AddMedicalNoteForm({ childId }: { childId: string }) {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        const res = await addMedicalNote(childId, content);
        setIsSubmitting(false);

        if (res.success) {
            toast.success('Medical note added successfully');
            setContent('');
        } else {
            toast.error(res.error || 'Failed to add medical note');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <textarea
                placeholder="E.g., Allergic to peanuts, needs inhaler for asthma..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="w-full bg-card-low border border-outline-variant/20 rounded-xl p-3 text-white placeholder:text-on-surface-variant focus:outline-none focus:border-primary/50 transition-colors"
                rows={3}
            />
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting || !content.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-sm font-bold text-white hover:bg-primary-dim transition-colors disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" />
                    {isSubmitting ? 'Saving...' : 'Add Note'}
                </button>
            </div>
        </form>
    );
}
