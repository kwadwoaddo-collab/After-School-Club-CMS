import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, FileText, User } from 'lucide-react';
import { AddMedicalNoteForm } from '@/components/portal/AddMedicalNoteForm';

export default async function ChildDetailsPage(props: { params: Promise<{ id: string }> }) {
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    const { id } = await props.params;

    const child = await db.query.children.findFirst({
        where: and(
            eq(children.id, id),
            eq(children.parentId, parent.id)
        ),
        with: {
            notes: {
                orderBy: (notes, { desc }) => [desc(notes.createdAt)]
            }
        }
    });

    if (!child) redirect('/portal');

    return (
        <div className="min-h-screen bg-surface text-on-surface pb-12">
            <header className="bg-surface-container-high border-b border-outline-variant/10 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/portal" className="p-2 -ml-2 rounded-lg hover:bg-surface-bright transition-colors text-on-surface-variant">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-white">{child.firstName} {child.lastName}</h1>
                        <p className="text-xs text-on-surface-variant">Student Profile</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                {/* Basic Details */}
                <section className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/10 pb-4">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold text-white">Basic Information</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm text-on-surface-variant mb-1">First Name</p>
                            <p className="font-medium text-white">{child.firstName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-on-surface-variant mb-1">Last Name</p>
                            <p className="font-medium text-white">{child.lastName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-on-surface-variant mb-1">School Year</p>
                            <p className="font-medium text-white">{child.schoolYear}</p>
                        </div>
                        <div>
                            <p className="text-sm text-on-surface-variant mb-1">Date of Birth</p>
                            <p className="font-medium text-white">
                                {child.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString('en-GB') : 'Not provided'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Medical & Dietary Notes */}
                <section className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/10 pb-4">
                        <ShieldAlert className="w-5 h-5 text-error" />
                        <h2 className="text-lg font-bold text-white">Medical & Dietary Needs</h2>
                    </div>

                    <div className="space-y-4">
                        {child.notes.length === 0 ? (
                            <div className="bg-surface-container-low p-6 rounded-xl border border-dashed border-outline-variant/20 text-center">
                                <p className="text-sm text-on-surface-variant">No medical or dietary notes on file.</p>
                            </div>
                        ) : (
                            child.notes.map(note => (
                                <div key={note.id} className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${note.category === 'Medical' || note.category === 'Safeguarding' ? 'bg-error/10 text-error border border-error/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                            {note.category}
                                        </span>
                                        <span className="text-xs text-on-surface-variant">
                                            {new Date(note.createdAt).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white whitespace-pre-wrap">{note.content}</p>
                                    <p className="text-xs text-on-surface-variant mt-2">Added by: {note.authorName}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-outline-variant/10">
                        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            Add New Medical Note
                        </h3>
                        <p className="text-xs text-on-surface-variant mb-4">
                            Please provide any updates to allergies, medication, or specific needs. This information is critical for our staff.
                        </p>
                        <AddMedicalNoteForm childId={child.id} />
                    </div>
                </section>
            </main>
        </div>
    );
}
