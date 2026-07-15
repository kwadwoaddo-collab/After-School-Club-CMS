'use client';

import { format } from 'date-fns';
import { useState, useTransition } from 'react';
import { deleteStudentNote, toggleStudentNotePin, editStudentNote } from '@/features/students/notes.actions';
import { Pin, Trash2, Edit3, BookOpen, Users, Star, Stethoscope, Clock, Smile, ThumbsUp, Meh, ThumbsDown, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

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

const NOTE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
    general:            { label: 'General',    icon: <BookOpen className="w-3 h-3" />,      badgeClass: 'bg-gray-100 text-gray-600' },
    progress:           { label: 'Progress',   icon: <TrendingUp className="w-3 h-3" />,    badgeClass: 'bg-blue-100 text-blue-700' },
    subject_feedback:   { label: 'Activity',   icon: <Star className="w-3 h-3" />,          badgeClass: 'bg-violet-100 text-violet-700' },
    behaviour:          { label: 'Behaviour',  icon: <Users className="w-3 h-3" />,         badgeClass: 'bg-amber-100 text-amber-700' },
    attendance_concern: { label: 'Attendance', icon: <Clock className="w-3 h-3" />,         badgeClass: 'bg-orange-100 text-orange-700' },
    medical:            { label: 'Medical',    icon: <Stethoscope className="w-3 h-3" />,   badgeClass: 'bg-red-100 text-red-700' },
};

const RATING_CONFIG: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
    excellent:         { label: 'Excellent',         icon: <Smile className="w-3 h-3" />,         badgeClass: 'bg-emerald-100 text-emerald-700' },
    good:              { label: 'Good',              icon: <ThumbsUp className="w-3 h-3" />,       badgeClass: 'bg-blue-100 text-blue-700' },
    satisfactory:      { label: 'Satisfactory',      icon: <Meh className="w-3 h-3" />,            badgeClass: 'bg-amber-100 text-amber-700' },
    needs_improvement: { label: 'Needs Improvement', icon: <ThumbsDown className="w-3 h-3" />,     badgeClass: 'bg-orange-100 text-orange-700' },
    unsatisfactory:    { label: 'Unsatisfactory',    icon: <AlertTriangle className="w-3 h-3" />,  badgeClass: 'bg-red-100 text-red-700' },
};

const FILTER_OPTIONS = ['All', 'General', 'Progress', 'Activity', 'Behaviour', 'Medical'];

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
            (filter === 'Activity' && typeKey === 'subject_feedback');
    });

    const pinnedNotes   = filtered.filter(n => n.pinnedAt);
    const unpinnedNotes = filtered.filter(n => !n.pinnedAt);
    const sortedNotes   = [...pinnedNotes, ...unpinnedNotes];

    const handlePin = (noteId: string, currentlyPinned: boolean) => {
        startTransition(async () => {
            try { await toggleStudentNotePin(noteId, !currentlyPinned); }
            catch (e: any) { toast.error(e.message || 'Failed to pin note'); }
        });
    };

    const handleDelete = (noteId: string) => {
        startTransition(async () => {
            try { await deleteStudentNote(noteId); toast.success('Note deleted'); }
            catch (e: any) { toast.error(e.message || 'Failed to delete note'); }
        });
    };

    const handleSaveEdit = (noteId: string) => {
        if (!editingContent.trim()) return;
        startTransition(async () => {
            try { await editStudentNote(noteId, editingContent); setEditingId(null); toast.success('Note updated'); }
            catch (e: any) { toast.error(e.message || 'Failed to update note'); }
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
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            filter === opt
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {opt}
                    </button>
                ))}
                <span className="ml-auto text-xs text-gray-400 font-medium">
                    {filtered.length} note{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {sortedNotes.length === 0 ? (
                <div className="py-10 flex flex-col items-center text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                    <BookOpen className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}notes yet.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
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
                                className={`relative group border rounded-2xl p-4 transition-all ${
                                    isPinned
                                        ? 'border-blue-200 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                                {/* Pin dot */}
                                {isPinned && (
                                    <div className="absolute top-3.5 right-10 text-blue-500">
                                        <Pin className="w-3 h-3 fill-current" />
                                    </div>
                                )}

                                {/* Hover actions */}
                                <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canPin && (
                                        <button
                                            onClick={() => handlePin(note.id, isPinned)}
                                            disabled={isPending}
                                            title={isPinned ? 'Unpin' : 'Pin to top'}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                                isPinned ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                            }`}
                                        >
                                            <Pin className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button
                                            onClick={() => { setEditingId(note.id); setEditingContent(note.content); }}
                                            disabled={isPending}
                                            title="Edit note"
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(note.id)}
                                            disabled={isPending}
                                            title="Delete note"
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${typeConfig.badgeClass}`}>
                                        {typeConfig.icon} {typeConfig.label}
                                    </span>
                                    {note.subject && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600">
                                            {note.subject}
                                        </span>
                                    )}
                                    {ratingConfig && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${ratingConfig.badgeClass}`}>
                                            {ratingConfig.icon} {ratingConfig.label}
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                {editingId === note.id ? (
                                    <div className="space-y-2.5 mt-1">
                                        <textarea
                                            value={editingContent}
                                            onChange={e => setEditingContent(e.target.value)}
                                            className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y min-h-[80px] transition-all"
                                            disabled={isPending}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingId(null)}
                                                disabled={isPending}
                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-bold transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSaveEdit(note.id)}
                                                disabled={!editingContent.trim() || isPending}
                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                                            >
                                                {isPending ? 'Saving…' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                )}

                                {/* Footer */}
                                <p className="text-[11px] text-gray-400 font-medium mt-2.5">
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
