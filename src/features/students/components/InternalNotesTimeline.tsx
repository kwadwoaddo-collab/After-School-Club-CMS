'use client';

import { useState, useTransition } from 'react';
import { addStudentNote, deleteStudentNote, toggleStudentNotePin } from '@/features/students/notes.actions';
import { formatDistanceToNow, format } from 'date-fns';
import { Clock, User, Pin, PinOff, AlertTriangle, Shield } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';

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
      <div className="bg-secondary rounded-2xl p-4 border border-border">
        <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
          Add New Note
        </label>
        
        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer">
            <input 
              type="radio" 
              name="noteCategory" 
              className="text-primary focus:ring-primary"
              checked={category === 'General'} 
              onChange={() => setCategory('General')} 
            />
            General Note
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-destructive cursor-pointer">
            <input 
              type="radio" 
              name="noteCategory" 
              className="text-destructive focus:ring-destructive"
              checked={category === 'Medical'} 
              onChange={() => setCategory('Medical')} 
            />
            <AlertTriangle className="w-4 h-4" />
            Medical / Allergy
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-primary cursor-pointer">
            <input 
              type="radio" 
              name="noteCategory" 
              className="text-primary focus:ring-primary/50"
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
          className="w-full bg-card border border-border text-foreground rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none min-h-[80px]"
          disabled={isPending}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAddNote}
            disabled={!content.trim() || isPending}
            className="px-4 py-2 bg-foreground text-background font-bold rounded-xl shadow-sm hover:bg-foreground/90 disabled:opacity-50 transition-all ml-auto"
          >
            {isPending ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* High Priority Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-warning uppercase tracking-wider">High Priority</h3>
            <div className="h-px bg-warning/20 flex-1" />
          </div>
          {pinnedNotes.map((note) => (
            <div key={note.id} className="bg-warning/5 rounded-2xl p-4 border border-warning/20 shadow-sm relative overflow-hidden group">
              {/* Decorative background element */}
              <div className="absolute -top-3 -right-3 w-16 h-16 bg-warning/20 rounded-full opacity-50 pointer-events-none" />
              <div className="absolute top-4 right-4 text-warning opacity-20 pointer-events-none transform rotate-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 3H8v2l2 2v5l-4 4v2h5v7l1 1 1-1v-7h5v-2l-4-4V7l2-2V3z"/></svg>
              </div>

              <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="flex items-center gap-2">
                  {note.category === 'Medical' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-bold text-destructive">{note.authorName}</span>
                    </>
                  ) : note.category === 'Safeguarding' ? (
                    <>
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold text-primary">{note.authorName}</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-bold text-foreground">{note.authorName}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Clock className="w-3 h-3" />
                  <span title={format(new Date(note.createdAt), 'PPpp')}>
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </span>
                  
                  <button
                    onClick={() => handleTogglePin(note.id, false)}
                    disabled={isPending}
                    className="ml-2 p-1 hover:bg-warning/20 text-warning font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Unpin Note"
                  >
                    <PinOff className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={isPending}
                    className="ml-2 text-destructive hover:text-destructive/80 font-medium disabled:opacity-50 transition-colors"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed relative z-10 font-medium">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {standardNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium italic text-center py-4">
            No standard notes found.
          </p>
        ) : (
          standardNotes.map((note) => (
            <div key={note.id} className="relative pl-6 pb-2 group">
              {/* Timeline Connector */}
              <div className="absolute left-1.5 top-2 bottom-0 w-0.5 bg-border group-last:bg-transparent" />
              {/* Timeline Dot */}
              <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              </div>

              <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {note.category === 'Medical' ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span className="text-sm font-bold text-destructive">{note.authorName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-destructive/20 bg-destructive/10 text-destructive font-bold uppercase tracking-wider ml-1">Medical</span>
                      </>
                    ) : note.category === 'Safeguarding' ? (
                      <>
                        <Shield className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-primary">{note.authorName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary font-bold uppercase tracking-wider ml-1">Safeguarding</span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-bold text-foreground">{note.authorName}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Clock className="w-3 h-3" />
                    <span title={format(new Date(note.createdAt), 'PPpp')}>
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </span>

                    <button
                      onClick={() => handleTogglePin(note.id, !note.pinnedAt)}
                      disabled={isPending}
                      className="ml-2 p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                      title={note.pinnedAt ? "Unpin Note" : "Pin Note"}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={isPending}
                      className="ml-1 text-destructive hover:text-destructive/80 font-medium disabled:opacity-50 transition-colors"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
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
