'use client';

import { useState, useTransition } from 'react';
import { addStudentNote, deleteStudentNote } from '@/features/students/actions';
import { format } from 'date-fns';
import { Trash2, MessageSquare, Loader2 } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';

interface Note {
    id: string;
    content: string;
    authorName: string;
    authorId: string;
    createdAt: Date;
}

interface StudentNotesPanelProps {
    childId: string;
    childName: string;
    notes: Note[];
    currentUserId?: string;
}

export default function StudentNotesPanel({ childId, childName, notes, currentUserId }: StudentNotesPanelProps) {
    const [newNote, setNewNote] = useState('');
    const [isPending, startTransition] = useTransition();
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        startTransition(async () => {
            await addStudentNote(childId, newNote.trim());
            setNewNote('');
        });
    };

    const handleDelete = (noteId: string) => {
        setNoteToDelete(noteId);
    };

    const confirmDelete = () => {
        if (!noteToDelete) return;
        startTransition(async () => {
            await deleteStudentNote(noteToDelete);
            setNoteToDelete(null);
        });
    };

    return (
        <>
        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                Internal Notes: {childName}
            </h4>
            
            <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-2">
                {notes.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-4">No internal notes yet.</p>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative group">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                            <div className="flex items-center justify-between mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <span>Observation by {note.authorName} • {format(new Date(note.createdAt), 'MMM d, h:mm a')}</span>
                            </div>
                            {(currentUserId === note.authorId) && (
                                <button 
                                    onClick={() => handleDelete(note.id)}
                                    disabled={isPending}
                                    className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-slate-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="flex gap-3">
                <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a new internal note..."
                    rows={2}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                    disabled={isPending}
                />
                <button
                    onClick={handleAddNote}
                    disabled={isPending || !newNote.trim()}
                    className="px-6 py-2 bg-slate-900 border border-slate-800 text-white font-bold rounded-2xl shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 h-auto self-end"
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Note'}
                </button>
            </div>
        </div>
        <ConfirmModal
            isOpen={!!noteToDelete}
            onClose={() => setNoteToDelete(null)}
            onConfirm={confirmDelete}
            title="Delete Note?"
            description="Are you sure you want to delete this note? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
        />
        </>
    );
}
