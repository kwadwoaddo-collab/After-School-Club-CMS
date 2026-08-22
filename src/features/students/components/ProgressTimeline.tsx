'use client';

import { format } from 'date-fns';
import { useToast } from '@/components/ui/ToastProvider';
import { useState, useTransition } from 'react';
import { deleteStudentNote, toggleStudentNotePin, editStudentNote } from '@/features/students/notes.actions';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/Button';
import { Pin, Trash2, Edit3, BookOpen, Users, Star, Stethoscope, Clock, Smile, ThumbsUp, Meh, ThumbsDown, AlertTriangle, TrendingUp } from 'lucide-react';

type NoteType = 'general' | 'progress' | 'behaviour' | 'subject_feedback' | 'attendance_concern' | 'medical' | null;
type Rating   = 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory' | null;

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

// Same soft-token pairing as Badge.tsx (bg-*-soft + literal color-700/400
// text with a dark: pair — --color-success/warning/info are fixed hexes,
// not theme-toggling tokens, so the text color needs its own dark variant).
const NOTE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
    general:            { label: 'General',    icon: <BookOpen className="w-3 h-3" />,      badgeClass: 'bg-page text-text-secondary border border-border-subtle' },
    progress:           { label: 'Progress',   icon: <TrendingUp className="w-3 h-3" />,    badgeClass: 'bg-accent-soft text-accent' },
    subject_feedback:   { label: 'Activity',   icon: <Star className="w-3 h-3" />,          badgeClass: 'bg-accent-soft text-accent' },
    behaviour:          { label: 'Behaviour',  icon: <Users className="w-3 h-3" />,         badgeClass: 'bg-warning-soft text-amber-700 dark:text-amber-400' },
    attendance_concern: { label: 'Attendance', icon: <Clock className="w-3 h-3" />,         badgeClass: 'bg-warning-soft text-amber-700 dark:text-amber-400' },
    medical:            { label: 'Medical',    icon: <Stethoscope className="w-3 h-3" />,   badgeClass: 'bg-danger-soft text-danger' },
};

const RATING_CONFIG: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
    excellent:         { label: 'Excellent',         icon: <Smile className="w-3 h-3" />,         badgeClass: 'bg-success-soft text-emerald-700 dark:text-emerald-400' },
    good:              { label: 'Good',              icon: <ThumbsUp className="w-3 h-3" />,       badgeClass: 'bg-accent-soft text-accent' },
    satisfactory:      { label: 'Satisfactory',      icon: <Meh className="w-3 h-3" />,            badgeClass: 'bg-warning-soft text-amber-700 dark:text-amber-400' },
    needs_improvement: { label: 'Needs Improvement', icon: <ThumbsDown className="w-3 h-3" />,     badgeClass: 'bg-warning-soft text-amber-700 dark:text-amber-400' },
    unsatisfactory:    { label: 'Unsatisfactory',    icon: <AlertTriangle className="w-3 h-3" />,  badgeClass: 'bg-danger-soft text-danger' },
};

const FILTER_OPTIONS = ['All', 'General', 'Progress', 'Activity', 'Behaviour', 'Medical'];

export default function ProgressTimeline({ notes, currentUserId, currentUserRole }: ProgressTimelineProps) {
    const [filter, setFilter] = useState('All');
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');

    const isAdmin = currentUserRole === 'ORG_OWNER' || currentUserRole === 'MANAGER';

    const filtered = notes.filter(note => {
        if (filter === 'All') return true;
        const typeKey = note.noteType || 'general';
        const config = NOTE_TYPE_CONFIG[typeKey];
        return config?.label.toLowerCase() === filter.toLowerCase() ||
            (filter === 'Activity' && typeKey === 'subject_feedback');
    });

    const pinnedNotes   = filtered.filter(n => n.pinnedAt);
    const unpinnedNotes = filtered.filter(n => !n.pinnedAt);
    const sortedNotes   = [...pinnedNotes, ...unpinnedNotes];

    const handlePin = (noteId: string, currentlyPinned: boolean) => {
        startTransition(async () => {
            try { await toggleStudentNotePin(noteId, !currentlyPinned); }
            catch (e) { const message = e instanceof Error ? e.message : undefined; toast({ title: 'Error', message: message || 'Failed to pin note', variant: 'error' }); }
        });
    };

    const handleDelete = (noteId: string) => {
        startTransition(async () => {
            try { await deleteStudentNote(noteId); toast({ title: 'Success', message: 'Note deleted', variant: 'success' }); }
            catch (e) { const message = e instanceof Error ? e.message : undefined; toast({ title: 'Error', message: message || 'Failed to delete note', variant: 'error' }); }
        });
    };

    const handleSaveEdit = (noteId: string) => {
        if (!editingContent.trim()) return;
        startTransition(async () => {
            try { await editStudentNote(noteId, editingContent); setEditingId(null); toast({ title: 'Success', message: 'Note updated', variant: 'success' }); }
            catch (e) { const message = e instanceof Error ? e.message : undefined; toast({ title: 'Error', message: message || 'Failed to update note', variant: 'error' }); }
        });
    };

    return (
        <div className="space-y-3">
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1.5 items-center">
                {FILTER_OPTIONS.map(opt => (
                    <button
                        key={opt}
                        onClick={() => setFilter(opt)}
                        className={cn(
                            'px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
                            filter === opt
                                ? 'bg-accent text-white'
                                : 'bg-page text-text-secondary border border-border-subtle hover:border-border'
                        )}
                    >
                        {opt}
                    </button>
                ))}
                <span className="ml-auto text-metadata">
                    {filtered.length} note{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {sortedNotes.length === 0 ? (
                <div className="py-8 flex flex-col items-center text-center border border-dashed border-border-subtle rounded-md bg-page">
                    <BookOpen className="w-6 h-6 text-text-muted mb-2" />
                    <p className="text-small-body text-text-muted">No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}notes yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sortedNotes.map(note => {
                        const typeKey    = (note.noteType || 'general') as string;
                        const typeConfig  = NOTE_TYPE_CONFIG[typeKey] || NOTE_TYPE_CONFIG.general;
                        const ratingConfig = note.rating ? RATING_CONFIG[note.rating] : null;
                        const isPinned   = !!note.pinnedAt;
                        const canDelete  = note.userId === currentUserId || isAdmin;
                        const canPin     = note.userId === currentUserId || isAdmin;
                        const canEdit    = note.userId === currentUserId || isAdmin;

                        return (
                            <div
                                key={note.id}
                                className={cn(
                                    'relative group rounded-md border p-3.5 transition-colors',
                                    isPinned ? 'border-accent/30 bg-accent-soft' : 'border-border-subtle bg-surface'
                                )}
                            >
                                {/* Pin dot */}
                                {isPinned && (
                                    <div className="absolute top-3 right-9 text-accent">
                                        <Pin className="w-3 h-3 fill-current" />
                                    </div>
                                )}

                                {/* Hover actions */}
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    {canPin && (
                                        <button
                                            onClick={() => handlePin(note.id, isPinned)}
                                            disabled={isPending}
                                            title={isPinned ? 'Unpin' : 'Pin to top'}
                                            className={cn(
                                                'p-1.5 rounded-sm transition-colors',
                                                isPinned ? 'text-accent bg-accent-soft' : 'text-text-muted hover:text-accent hover:bg-accent-soft'
                                            )}
                                        >
                                            <Pin className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button
                                            onClick={() => { setEditingId(note.id); setEditingContent(note.content); }}
                                            disabled={isPending}
                                            title="Edit note"
                                            className="p-1.5 rounded-sm text-text-muted hover:text-accent hover:bg-accent-soft transition-colors"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(note.id)}
                                            disabled={isPending}
                                            title="Delete note"
                                            className="p-1.5 rounded-sm text-text-muted hover:text-danger hover:bg-danger-soft transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium', typeConfig.badgeClass)}>
                                        {typeConfig.icon} {typeConfig.label}
                                    </span>
                                    {note.subject && (
                                        <span className="px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-page text-text-secondary border border-border-subtle">
                                            {note.subject}
                                        </span>
                                    )}
                                    {ratingConfig && (
                                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium', ratingConfig.badgeClass)}>
                                            {ratingConfig.icon} {ratingConfig.label}
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                {editingId === note.id ? (
                                    <div className="space-y-2 mt-1">
                                        <textarea
                                            value={editingContent}
                                            onChange={e => setEditingContent(e.target.value)}
                                            className="w-full bg-surface border border-border rounded-sm p-2.5 text-small-body text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent resize-y min-h-[80px] transition-colors"
                                            disabled={isPending}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => setEditingId(null)} disabled={isPending}>
                                                Cancel
                                            </Button>
                                            <Button size="sm" onClick={() => handleSaveEdit(note.id)} disabled={!editingContent.trim() || isPending}>
                                                {isPending ? 'Saving…' : 'Save'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-small-body text-text leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                )}

                                {/* Footer */}
                                <p className="text-metadata mt-2">
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
