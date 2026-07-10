'use client';

import { useState, useTransition } from 'react';
import { addStudentNote } from '@/features/students/notes.actions';
import { BookOpen, Smile, Meh, ThumbsUp, ThumbsDown, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

type NoteType = 'general' | 'progress' | 'behaviour' | 'subject_feedback' | 'attendance_concern' | 'medical';
type Rating = 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

const NOTE_TYPES: { value: NoteType; label: string; color: string }[] = [
    { value: 'general', label: 'General', color: 'bg-slate-100 text-slate-700 ring-slate-200' },
    { value: 'progress', label: 'Progress', color: 'bg-blue-100 text-blue-700 ring-blue-200' },
    { value: 'subject_feedback', label: 'Activity Feedback', color: 'bg-violet-100 text-violet-700 ring-violet-200' },
    { value: 'behaviour', label: 'Behaviour', color: 'bg-amber-100 text-amber-700 ring-amber-200' },
    { value: 'attendance_concern', label: 'Attendance Concern', color: 'bg-orange-100 text-orange-700 ring-orange-200' },
    { value: 'medical', label: 'Medical / Welfare', color: 'bg-red-100 text-red-700 ring-red-200' },
];

const RATINGS: { value: Rating; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'excellent', label: 'Excellent', icon: <Smile className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700 ring-emerald-300 hover:bg-emerald-200' },
    { value: 'good', label: 'Good', icon: <ThumbsUp className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 ring-blue-300 hover:bg-blue-200' },
    { value: 'satisfactory', label: 'Satisfactory', icon: <Meh className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 ring-amber-300 hover:bg-amber-200' },
    { value: 'needs_improvement', label: 'Needs Improvement', icon: <ThumbsDown className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700 ring-orange-300 hover:bg-orange-200' },
    { value: 'unsatisfactory', label: 'Unsatisfactory', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-red-100 text-red-700 ring-red-300 hover:bg-red-200' },
];

const SUBJECTS = ['Homework Help', 'Creative Arts', 'Sports & Games', 'Science & Tech', 'Reading', 'Writing', 'Art', 'Music', 'Computing', 'Board Games', 'Other'];

interface ProgressNoteFormProps {
    childId: string;
    childName: string;
}

export default function ProgressNoteForm({ childId, childName }: ProgressNoteFormProps) {
    const [content, setContent] = useState('');
    const [noteType, setNoteType] = useState<NoteType>('general');
    const [subject, setSubject] = useState('');
    const [rating, setRating] = useState<Rating | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isExpanded, setIsExpanded] = useState(false);

    const needsSubject = noteType === 'subject_feedback' || noteType === 'progress';
    const needsRating = noteType !== 'general' && noteType !== 'medical';

    const handleSubmit = () => {
        if (!content.trim()) return;
        startTransition(async () => {
            try {
                await addStudentNote(childId, content.trim(), noteType, {
                    noteType,
                    subject: needsSubject ? subject || undefined : undefined,
                    rating: (needsRating && rating) ? rating : undefined,
                });
                setContent('');
                setRating(null);
                setSubject('');
                setNoteType('general');
                toast.success('Progress note saved.');
            } catch (e: any) {
                toast.error(e.message || 'Failed to save note');
            }
        });
    };

    return (
        <div className="bg-surface-container-high border border-outline-variant/10 rounded-[28px] overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-white">Add Progress Note</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isExpanded && (
                <div className="px-6 pb-6 space-y-4 border-t border-outline-variant/10 pt-4">
                    {/* Note Type selector */}
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Note Type</label>
                        <div className="flex flex-wrap gap-2">
                            {NOTE_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setNoteType(type.value)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold ring-1 transition-all ${type.color} ${noteType === type.value ? 'ring-2 scale-105' : 'opacity-60 hover:opacity-100'}`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject picker (for progress/subject_feedback) */}
                    {needsSubject && (
                        <div>
                            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Activity / Club</label>
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full bg-white/5 border border-outline-variant/20 text-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                            >
                                <option value="">Select activity…</option>
                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Rating */}
                    {needsRating && (
                        <div>
                            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Performance Rating</label>
                            <div className="flex flex-wrap gap-2">
                                {RATINGS.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => setRating(prev => prev === r.value ? null : r.value)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 transition-all ${r.color} ${rating === r.value ? 'ring-2 scale-105' : 'opacity-60 hover:opacity-100'}`}
                                    >
                                        {r.icon} {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Note content */}
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Note</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder={`Add a ${NOTE_TYPES.find(t => t.value === noteType)?.label.toLowerCase()} note for ${childName}…`}
                            rows={3}
                            className="w-full bg-white/5 border border-outline-variant/20 text-white rounded-xl px-4 py-3 text-sm placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none resize-none"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={isPending || !content.trim()}
                            className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Save Note
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
