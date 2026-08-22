'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { addStudentNote } from '@/features/students/notes.actions';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/Button';
import { Smile, Meh, ThumbsUp, ThumbsDown, AlertTriangle, Loader2, ChevronDown, Plus } from 'lucide-react';

type NoteType = 'general' | 'progress' | 'behaviour' | 'subject_feedback' | 'attendance_concern' | 'medical';
type Rating = 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

// Shared soft/solid pairing — same semantic tokens as Badge.tsx (bg-*-soft +
// literal color-700/400 text with a dark: pair, since --color-success/
// --color-warning/--color-info are fixed hexes rather than theme-toggling
// tokens). Kept local here rather than widened into Badge because these are
// interactive toggle chips (selected/unselected), not the read-only Badge.
const CHIP_IDLE: Record<string, string> = {
    neutral: 'bg-page text-text-secondary border border-border-subtle hover:border-border',
    accent:  'bg-accent-soft text-accent hover:bg-accent-soft/80',
    warning: 'bg-warning-soft text-amber-700 dark:text-amber-400 hover:bg-warning-soft/80',
    danger:  'bg-danger-soft text-danger hover:bg-danger-soft/80',
    success: 'bg-success-soft text-emerald-700 dark:text-emerald-400 hover:bg-success-soft/80',
};
const CHIP_ACTIVE: Record<string, string> = {
    neutral: 'bg-text text-page',
    accent:  'bg-accent text-white',
    warning: 'bg-amber-600 text-white',
    danger:  'bg-danger text-white',
    success: 'bg-emerald-600 text-white',
};

const NOTE_TYPES: { value: NoteType; label: string; tone: keyof typeof CHIP_IDLE }[] = [
    { value: 'general',            label: 'General',            tone: 'neutral' },
    { value: 'progress',           label: 'Progress',           tone: 'accent' },
    { value: 'subject_feedback',   label: 'Activity Feedback',  tone: 'accent' },
    { value: 'behaviour',          label: 'Behaviour',          tone: 'warning' },
    { value: 'attendance_concern', label: 'Attendance Concern', tone: 'warning' },
    { value: 'medical',            label: 'Medical / Welfare',  tone: 'danger' },
];

const RATINGS: { value: Rating; label: string; icon: React.ReactNode; tone: keyof typeof CHIP_IDLE }[] = [
    { value: 'excellent',         label: 'Excellent',         icon: <Smile className="w-3.5 h-3.5" />,         tone: 'success' },
    { value: 'good',              label: 'Good',              icon: <ThumbsUp className="w-3.5 h-3.5" />,      tone: 'accent' },
    { value: 'satisfactory',      label: 'Satisfactory',      icon: <Meh className="w-3.5 h-3.5" />,           tone: 'warning' },
    { value: 'needs_improvement', label: 'Needs Improvement', icon: <ThumbsDown className="w-3.5 h-3.5" />,    tone: 'warning' },
    { value: 'unsatisfactory',    label: 'Unsatisfactory',    icon: <AlertTriangle className="w-3.5 h-3.5" />, tone: 'danger' },
];

const SUBJECTS = ['Homework Help', 'Creative Arts', 'Sports & Games', 'Science & Tech', 'Reading', 'Writing', 'Art', 'Music', 'Computing', 'Board Games', 'Other'];

interface ProgressNoteFormProps {
    childId: string;
    childName: string;
}

export default function ProgressNoteForm({ childId, childName }: ProgressNoteFormProps) {
    const [content, setContent] = useState('');
    const { toast } = useToast();
    const [noteType, setNoteType] = useState<NoteType>('general');
    const [subject, setSubject] = useState('');
    const [rating, setRating] = useState<Rating | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isExpanded, setIsExpanded] = useState(false);

    const needsSubject = noteType === 'subject_feedback' || noteType === 'progress';
    const needsRating  = noteType !== 'general' && noteType !== 'medical';

    const handleSubmit = () => {
        if (!content.trim()) return;
        startTransition(async () => {
            try {
                await addStudentNote(childId, content.trim(), noteType, {
                    noteType,
                    subject: needsSubject ? subject || undefined : undefined,
                    rating: (needsRating && rating) ? rating : undefined,
                });
                setContent(''); setRating(null); setSubject(''); setNoteType('general');
                setIsExpanded(false);
                toast({ title: 'Success', message: 'Progress note saved.', variant: 'success' });
            } catch (e) {
                const message = e instanceof Error ? e.message : undefined;
                toast({ title: 'Error', message: message || 'Failed to save note', variant: 'error' });
            }
        });
    };

    return (
        <div className="rounded-md border border-border-subtle bg-surface overflow-hidden">
            {/* Collapsed header */}
            <button
                onClick={() => setIsExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-none hover:bg-page transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-sm bg-accent-soft flex items-center justify-center">
                        <Plus className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-small-body font-semibold text-text">Add Progress Note</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-text-muted transition-transform duration-200', isExpanded && 'rotate-180')} />
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-border-subtle pt-4">
                    {/* Note type */}
                    <div>
                        <label className="text-label text-text-muted block mb-2">Note Type</label>
                        <div className="flex flex-wrap gap-1.5">
                            {NOTE_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setNoteType(type.value)}
                                    className={cn(
                                        'px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
                                        noteType === type.value ? CHIP_ACTIVE[type.tone] : CHIP_IDLE[type.tone]
                                    )}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject */}
                    {needsSubject && (
                        <div>
                            <label className="text-label text-text-muted block mb-2">Activity / Club</label>
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                            >
                                <option value="">Select activity…</option>
                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Rating */}
                    {needsRating && (
                        <div>
                            <label className="text-label text-text-muted block mb-2">Performance Rating</label>
                            <div className="flex flex-wrap gap-1.5">
                                {RATINGS.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => setRating(prev => prev === r.value ? null : r.value)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
                                            rating === r.value ? CHIP_ACTIVE[r.tone] : CHIP_IDLE[r.tone]
                                        )}
                                    >
                                        {r.icon} {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        <label className="text-label text-text-muted block mb-2">Note</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder={`Add a ${NOTE_TYPES.find(t => t.value === noteType)?.label.toLowerCase()} note for ${childName}…`}
                            rows={3}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-sm text-small-body text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors resize-none"
                        />
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSubmit} disabled={isPending || !content.trim()} size="sm">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save Note
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
