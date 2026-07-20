'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { addStudentNote } from '@/features/students/notes.actions';
import { BookOpen, Smile, Meh, ThumbsUp, ThumbsDown, AlertTriangle, Loader2, ChevronDown, Plus } from 'lucide-react';

type NoteType = 'general' | 'progress' | 'behaviour' | 'subject_feedback' | 'attendance_concern' | 'medical';
type Rating = 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

const NOTE_TYPES: { value: NoteType; label: string; color: string; active: string }[] = [
    { value: 'general',            label: 'General',            color: 'bg-secondary/60 text-muted-foreground hover:bg-secondary',         active: 'bg-secondary text-foreground' },
    { value: 'progress',           label: 'Progress',           color: 'bg-primary/10 text-primary hover:bg-primary/20',          active: 'bg-primary text-primary-foreground' },
    { value: 'subject_feedback',   label: 'Activity Feedback',  color: 'bg-primary/15 text-primary hover:bg-primary/20',    active: 'bg-primary text-primary-foreground' },
    { value: 'behaviour',          label: 'Behaviour',          color: 'bg-warning/10 text-warning hover:bg-warning/20',       active: 'bg-warning text-white' },
    { value: 'attendance_concern', label: 'Attendance Concern', color: 'bg-warning/10 text-warning hover:bg-warning/20',    active: 'bg-warning text-white' },
    { value: 'medical',            label: 'Medical / Welfare',  color: 'bg-destructive/10 text-destructive hover:bg-destructive/20',             active: 'bg-destructive text-white' },
];

const RATINGS: { value: Rating; label: string; icon: React.ReactNode; color: string; active: string }[] = [
    { value: 'excellent',         label: 'Excellent',         icon: <Smile className="w-3.5 h-3.5" />,         color: 'bg-success/10 text-success hover:bg-success/20',  active: 'bg-success text-white' },
    { value: 'good',              label: 'Good',              icon: <ThumbsUp className="w-3.5 h-3.5" />,      color: 'bg-primary/10 text-primary hover:bg-primary/20',           active: 'bg-primary text-primary-foreground' },
    { value: 'satisfactory',      label: 'Satisfactory',      icon: <Meh className="w-3.5 h-3.5" />,           color: 'bg-warning/10 text-warning hover:bg-warning/20',        active: 'bg-warning text-white' },
    { value: 'needs_improvement', label: 'Needs Improvement', icon: <ThumbsDown className="w-3.5 h-3.5" />,    color: 'bg-warning/10 text-warning hover:bg-warning/20',     active: 'bg-warning text-white' },
    { value: 'unsatisfactory',    label: 'Unsatisfactory',    icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'bg-destructive/10 text-destructive hover:bg-destructive/20',              active: 'bg-destructive text-white' },
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
            } catch (e: any) {
                toast({ title: 'Error', message: e.message || 'Failed to save note', variant: 'error' });
            }
        });
    };

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Collapsed header */}
            <button
                onClick={() => setIsExpanded(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Add Progress Note</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                    {/* Note type */}
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Note Type</label>
                        <div className="flex flex-wrap gap-2">
                            {NOTE_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setNoteType(type.value)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                        noteType === type.value ? type.active : type.color
                                    }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject */}
                    {needsSubject && (
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Activity / Club</label>
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full bg-card border border-border text-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                            >
                                <option value="">Select activity…</option>
                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Rating */}
                    {needsRating && (
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Performance Rating</label>
                            <div className="flex flex-wrap gap-2">
                                {RATINGS.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => setRating(prev => prev === r.value ? null : r.value)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            rating === r.value ? r.active : r.color
                                        }`}
                                    >
                                        {r.icon} {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Note</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder={`Add a ${NOTE_TYPES.find(t => t.value === noteType)?.label.toLowerCase()} note for ${childName}…`}
                            rows={3}
                            className="w-full bg-card border border-border text-foreground rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={isPending || !content.trim()}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-sm shadow-primary/20"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save Note
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
