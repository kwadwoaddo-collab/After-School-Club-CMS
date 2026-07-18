'use client';

import { useState, useTransition } from 'react';
import { addStudentNote, deleteStudentNote, toggleStudentNotePin } from '@/features/students/notes.actions';
import { formatDistanceToNow, format } from 'date-fns';
import { Clock, User, Pin, PinOff, AlertTriangle, Shield } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';

interface Note {
  id: string;
  content: string;
  authorName: string;
  pinnedAt?: Date | null;
  category?: string;
  createdAt: Date;
}

interface InternalNotesTimelineProps {
  childId: string;
  initialNotes: Note[];
}

export default function InternalNotesTimeline({ childId, initialNotes }: InternalNotesTimelineProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'General' | 'Medical' | 'Safeguarding'>('General');
  const [isPending, startTransition] = useTransition();
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const pinnedNotes = initialNotes.filter(n => n.pinnedAt);
  const standardNotes = initialNotes.filter(n => !n.pinnedAt);

  const handleAddNote = () => {
    if (!content.trim()) return;

    startTransition(async () => {
      await addStudentNote(childId, content, category);
      setContent('');
      setCategory('General');
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

  const handleTogglePin = (noteId: string, pinned: boolean) => {
    startTransition(async () => {
      await toggleStudentNotePin(noteId, pinned);
    });
  };

  return (
    <>
    <div className="space-y-6 animate-fadeIn">
      {/* Form Area */}
      <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          Add New Note
        </label>
        
        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input 
              type="radio" 
              name="noteCategory" 
              className="text-primary focus:ring-primary"
              checked={category === 'General'} 
              onChange={() => setCategory('General')} 
            />
            General Note
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-rose-600 cursor-pointer">
            <input 
              type="radio" 
              name="noteCategory" 
              className="text-rose-500 focus:ring-rose-500"
              checked={category === 'Medical'} 
              onChange={() => setCategory('Medical')} 
            />
            <AlertTriangle className="w-4 h-4" />
            Medical / Allergy
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-blue-600 cursor-pointer">
            <input 
              type="radio" 
              name="noteCategory" 
              className="text-blue-500 focus:ring-primary/50"
              checked={category === 'Safeguarding'} 
              onChange={() => setCategory('Safeguarding')} 
            />
            <Shield className="w-4 h-4" />
            Safeguarding
          </label>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type observation or note..."
          className="w-full bg-card border border-slate-200 text-slate-900 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none min-h-[80px]"
          disabled={isPending}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAddNote}
            disabled={!content.trim() || isPending}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl shadow-sm hover:bg-slate-800 transition-colors text-sm disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* High Priority Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider">High Priority</h3>
            <div className="h-px bg-amber-200 flex-1" />
          </div>
          {pinnedNotes.map((note) => (
            <div key={note.id} className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200 shadow-sm relative overflow-hidden group">
              {/* Thumbtack Decoration */}
              <div className="absolute -top-3 -right-3 w-16 h-16 bg-amber-100 rounded-full opacity-50 pointer-events-none" />
              <div className="absolute top-4 right-4 text-amber-500 opacity-20 pointer-events-none transform rotate-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 3H8v2l2 2v5l-4 4v2h5v7l1 1 1-1v-7h5v-2l-4-4V7l2-2V3z"/></svg>
              </div>

              <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="flex items-center gap-2">
                  {note.category === 'Medical' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <span className="text-sm font-bold text-rose-700">{note.authorName}</span>
                    </>
                  ) : note.category === 'Safeguarding' ? (
                    <>
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-800">{note.authorName}</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-bold text-amber-900">{note.authorName}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-amber-700/70 text-xs">
                  <Clock className="w-3 h-3" />
                  <span title={format(new Date(note.createdAt), 'PPpp')}>
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </span>
                  
                  <button
                    onClick={() => handleTogglePin(note.id, false)}
                    disabled={isPending}
                    className="ml-2 p-1 hover:bg-amber-200 text-amber-600 font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Unpin Note"
                  >
                    <PinOff className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={isPending}
                    className="ml-2 text-rose-500 hover:text-rose-700 font-medium disabled:opacity-50 transition-colors"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-amber-950 whitespace-pre-wrap leading-relaxed relative z-10 font-medium">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {standardNotes.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium italic text-center py-4">
            No standard notes found.
          </p>
        ) : (
          standardNotes.map((note) => (
            <div key={note.id} className="relative pl-6 pb-2 group">
              {/* Timeline Connector */}
              <div className="absolute left-1.5 top-2 bottom-0 w-0.5 bg-slate-100 group-last:bg-transparent" />
              {/* Timeline Dot */}
              <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              </div>

              <div className="bg-card rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {note.category === 'Medical' ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span className="text-sm font-bold text-rose-700">{note.authorName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-600 font-bold uppercase tracking-wider ml-1">Medical</span>
                      </>
                    ) : note.category === 'Safeguarding' ? (
                      <>
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-blue-800">{note.authorName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 font-bold uppercase tracking-wider ml-1">Safeguarding</span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{note.authorName}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Clock className="w-3 h-3" />
                    <span title={format(new Date(note.createdAt), 'PPpp')}>
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </span>

                    <button
                      onClick={() => handleTogglePin(note.id, !note.pinnedAt)}
                      disabled={isPending}
                      className="ml-2 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-amber-500 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                      title={note.pinnedAt ? "Unpin Note" : "Pin Note"}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={isPending}
                      className="ml-1 text-rose-400 hover:text-rose-600 font-medium disabled:opacity-50 transition-colors"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>
              </div>
            </div>
          ))
        )}
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
