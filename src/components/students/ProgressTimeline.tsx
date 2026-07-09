'use client';

import { format } from 'date-fns';
import { useState, useTransition } from 'react';
import { deleteStudentNote, toggleStudentNotePin, editStudentNote } from '@/features/students/notes.actions';
import { Pin, Trash2, Edit3, BookOpen, Users, Star, Stethoscope, AlertCircle, Clock, Smile, ThumbsUp, Meh, ThumbsDown, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

type NoteType = 'general' | 'progress' | 'behaviour' | 'subject_feedback' | 'attendance_concern' | 'medical' | null;
type Rating = 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory' | null;

interface ProgressNote {
    id: string;
    content: string;
    authorName: string;
    userId: string | null;
    category: string;
    noteType: NoteType;
    subject: string | null;
    rating: Rating;
    pinnedAt: Date | null;
    createdAt: Date;
}

interface ProgressTimelineProps {
    notes: ProgressNote[];
    currentUserId?: string;
    currentUserRole?: string;
}

const NOTE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
    general: { label: 'General', icon: <BookOpen className="w-3.5 h-3.5" />, badgeClass: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
    progress: { label: 'Progress', icon: <TrendingUp className="w-3.5 h-3.5" />, badgeClass: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
    subject_feedback: { label: 'Subject', icon: <Star className="w-3.5 h-3.5" />, badgeClass: 'bg-violet-500/10 text-violet-400 ring-violet-500/20' },
    behaviour: { label: 'Behaviour', icon: <Users className="w-3.5 h-3.5" />, badgeClass: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
    attendance_concern: { label: 'Attendance', icon: <Clock className="w-3.5 h-3.5" />, badgeClass: 'bg-orange-500/10 text-orange-400 ring-orange-500/20' },
    medical: { label: 'Medical', icon: <Stethoscope className="w-3.5 h-3.5" />, badgeClass: 'bg-red-500/10 text-red-400 ring-red-500/20' },
};

const RATING_CONFIG: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
    excellent: { label: 'Excellent', icon: <Smile className="w-3.5 h-3.5" />, class: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
    good: { label: 'Good', icon: <ThumbsUp className="w-3.5 h-3.5" />, class: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
    satisfactory: { label: 'Satisfactory', icon: <Meh className="w-3.5 h-3.5" />, class: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
    needs_improvement: { label: 'Needs Improvement', icon: <ThumbsDown className="w-3.5 h-3.5" />, class: 'bg-orange-500/10 text-orange-400 ring-orange-500/20' },
    unsatisfactory: { label: 'Unsatisfactory', icon: <AlertTriangle className="w-3.5 h-3.5" />, class: 'bg-red-500/10 text-red-400 ring-red-500/20' },
};

const FILTER_OPTIONS = ['All', 'General', 'Progress', 'Subject', 'Behaviour', 'Medical'];

export default function ProgressTimeline({ notes, currentUserId, currentUserRole }: ProgressTimelineProps) {
    const [filter, setFilter] = useState('All');
    const [isPending, startTransition] = useTransition();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');

    const isAdmin = currentUserRole === 'ORG_OWNER' || currentUserRole === 'MANAGER';

    const filtered = notes.filter(note => {
        if (filter === 'All') return true;
        const typeKey = note.noteType || 'general';
        const config = NOTE_TYPE_CONFIG[typeKey];
        return config?.label.toLowerCase() === filter.toLowerCase() ||
            (filter === 'Subject' && typeKey === 'subject_feedback');
    });

    const pinnedNotes = filtered.filter(n => n.pinnedAt);
    const unpinnedNotes = filtered.filter(n => !n.pinnedAt);
    const sortedNotes = [...pinnedNotes, ...unpinnedNotes];

    const handlePin = (noteId: string, currentlyPinned: boolean) => {
        startTransition(async () => {
            try {
                await toggleStudentNotePin(noteId, !currentlyPinned);
            } catch (e: any) {
                toast.error(e.message || 'Failed to pin note');
            }
        });
    };

    const handleDelete = (noteId: string) => {
        startTransition(async () => {
            try {
                await deleteStudentNote(noteId);
                toast.success('Note deleted');
            } catch (e: any) {
                toast.error(e.message || 'Failed to delete note');
            }
        });
    };

    const handleSaveEdit = (noteId: string) => {
        if (!editingContent.trim()) return;
        startTransition(async () => {
            try {
                await editStudentNote(noteId, editingContent);
                setEditingId(null);
                toast.success('Note updated');
            } catch (e: any) {
                toast.error(e.message || 'Failed to update note');
            }
        });
    };

    return (
        <div className="space-y-4">
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map(opt => (
                    <button
                        key={opt}
                        onClick={() => setFilter(opt)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            filter === opt
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
                        }`}
                    >
                        {opt}
                    </button>
                ))}
                <span className="ml-auto text-xs text-on-surface-variant self-center">{filtered.length} note{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {sortedNotes.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center bg-white/5 rounded-[24px] border border-dashed border-outline-variant/20">
                    <BookOpen className="w-10 h-10 text-on-surface-variant/20 mb-3" />
                    <p className="text-sm text-on-surface-variant">No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}notes yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedNotes.map(note => {
                        const typeKey = (note.noteType || 'general') as string;
                        const typeConfig = NOTE_TYPE_CONFIG[typeKey] || NOTE_TYPE_CONFIG.general;
                        const ratingConfig = note.rating ? RATING_CONFIG[note.rating] : null;
                        const isPinned = !!note.pinnedAt;
                        const canDelete = note.userId === currentUserId || isAdmin;
                        const canPin = note.userId === currentUserId || isAdmin;

                        return (
                            <div
                                key={note.id}
                                className={`relative group bg-surface-container-high border rounded-[20px] p-5 transition-all ${
                                    isPinned
                                        ? 'border-primary/30 bg-primary/5'
                                        : 'border-outline-variant/10 hover:border-outline-variant/20'
                                }`}
                            >
                                {/* Pin indicator */}
                                {isPinned && (
                                    <div className="absolute top-4 right-12 text-primary">
                                        <Pin className="w-3.5 h-3.5 fill-current" />
                                    </div>
                                )}

                                {/* Actions (hover) */}
                                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canPin && (
                                        <button
                                            onClick={() => handlePin(note.id, isPinned)}
                                            disabled={isPending}
                                            className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'}`}
                                            title={isPinned ? 'Unpin' : 'Pin to top'}
                                        >
                                            <Pin className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                setEditingId(note.id);
                                                setEditingContent(note.content);
                                            }}
                                            disabled={isPending}
                                            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                                            title="Edit note"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(note.id)}
                                            disabled={isPending}
                                            className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                                            title="Delete note"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Badges row */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${typeConfig.badgeClass}`}>
                                        {typeConfig.icon} {typeConfig.label}
                                    </span>
                                    {note.subject && (
                                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant ring-1 ring-outline-variant/20">
                                            {note.subject}
                                        </span>
                                    )}
                                    {ratingConfig && (
                                        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${ratingConfig.class}`}>
                                            {ratingConfig.icon} {ratingConfig.label}
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                {editingId === note.id ? (
                                    <div className="space-y-3 mt-2">
                                        <textarea
                                            value={editingContent}
                                            onChange={(e) => setEditingContent(e.target.value)}
                                            className="w-full bg-[#1a1d23] text-white border border-[#424754]/30 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-y min-h-[80px]"
                                            disabled={isPending}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="px-3 py-1.5 rounded-lg bg-white/5 text-on-surface-variant hover:bg-white/10 text-xs font-bold transition-all"
                                                disabled={isPending}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSaveEdit(note.id)}
                                                disabled={!editingContent.trim() || isPending}
                                                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold transition-all disabled:opacity-50"
                                            >
                                                {isPending ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                )}

                                {/* Footer */}
                                <p className="text-[11px] text-on-surface-variant mt-3">
                                    {note.authorName} · {format(new Date(note.createdAt), 'MMM d, yyyy · h:mm a')}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
