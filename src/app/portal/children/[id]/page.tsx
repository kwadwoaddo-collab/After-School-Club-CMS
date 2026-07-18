import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { children, bookings, bookingAttendees, centres } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, ShieldAlert, FileText, User,
    CalendarDays, CheckCircle2, XCircle, Clock, MapPin, CalendarClock,
} from 'lucide-react';
import { AddMedicalNoteForm } from '@/components/portal/AddMedicalNoteForm';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'Upcoming', className: 'bg-primary/10 text-primary border-primary/20' },
    completed: { label: 'Attended', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    cancelled: { label: 'Cancelled', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    rescheduled: { label: 'Rescheduled', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    pending: { label: 'Pending', className: 'bg-secondary text-muted-foreground border-border' },
    signed_up: { label: 'Signed Up', className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
};

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

    // Fetch booking history for this child via bookingAttendees
    const attendeeRows = await db
        .select({
            bookingId: bookingAttendees.bookingId,
            attendanceStatus: bookingAttendees.attendanceStatus,
            bookingStartAt: bookings.startAt,
            bookingDuration: bookings.duration,
            bookingStatus: bookings.status,
            bookingConfirmationCode: bookings.confirmationCode,
            bookingModality: bookings.modality,
            centreName: centres.name,
            centreAddress: centres.address,
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(bookingAttendees.childId, id))
        .orderBy(desc(bookings.startAt));

    const now = new Date();
    const upcomingBookings = attendeeRows.filter(b => new Date(b.bookingStartAt) >= now && b.bookingStatus !== 'cancelled');
    const pastBookings = attendeeRows.filter(b => new Date(b.bookingStartAt) < now || b.bookingStatus === 'cancelled');

    return (
        <div className="min-h-screen bg-surface text-on-surface pb-12">
            <header className="bg-card border-b border-outline-variant/10 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/portal" className="p-2 -ml-2 rounded-lg hover:bg-card transition-colors text-on-surface-variant">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">{child.firstName} {child.lastName}</h1>
                        <p className="text-xs text-on-surface-variant">
                            {child.schoolYear} · {attendeeRows.length} session{attendeeRows.length !== 1 ? 's' : ''} total
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

                {/* Basic Details */}
                <section className="bg-card p-6 rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/10 pb-4">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Basic Information</h2>
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

                {/* Upcoming Bookings */}
                <section className="bg-card rounded-2xl border border-outline-variant/10 overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-5 border-b border-outline-variant/10">
                        <CalendarClock className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Upcoming Sessions</h2>
                        <span className="ml-auto text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                            {upcomingBookings.length}
                        </span>
                    </div>
                    {upcomingBookings.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                            <p className="text-sm text-on-surface-variant">No upcoming sessions booked.</p>
                            <Link href="/portal/book" className="inline-block mt-4 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                                Book a session →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-outline-variant/10">
                            {upcomingBookings.map(b => {
                                const cfg = STATUS_CONFIG[b.bookingStatus ?? 'pending'] ?? STATUS_CONFIG.pending;
                                const date = new Date(b.bookingStartAt);
                                return (
                                    <div key={b.bookingId} className="px-6 py-4 flex items-start gap-4">
                                        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-black text-primary uppercase">
                                                {date.toLocaleDateString('en-GB', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-black text-primary leading-none">
                                                {date.getDate()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="font-bold text-white text-sm">
                                                    {date.toLocaleDateString('en-GB', { weekday: 'long' })} · {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.className}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-on-surface-variant flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {b.centreName}
                                                {b.centreAddress && <span className="truncate"> · {b.centreAddress}</span>}
                                            </p>
                                            <p className="text-xs text-on-surface-variant mt-0.5">
                                                {b.bookingDuration} min · {b.bookingModality === 'online' ? 'Online' : 'In Person'}
                                                {b.bookingConfirmationCode && <span className="ml-2 font-mono font-bold text-primary/60">#{b.bookingConfirmationCode}</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Past Bookings */}
                {pastBookings.length > 0 && (
                    <section className="bg-card rounded-2xl border border-outline-variant/10 overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-5 border-b border-outline-variant/10">
                            <CalendarDays className="w-5 h-5 text-muted-foreground" />
                            <h2 className="text-lg font-bold text-foreground">Past Sessions</h2>
                            <span className="ml-auto text-xs font-bold text-muted-foreground bg-secondary border border-border px-2.5 py-1 rounded-lg">
                                {pastBookings.length}
                            </span>
                        </div>
                        <div className="divide-y divide-outline-variant/10">
                            {pastBookings.map(b => {
                                const cfg = STATUS_CONFIG[b.bookingStatus ?? 'pending'] ?? STATUS_CONFIG.pending;
                                const date = new Date(b.bookingStartAt);
                                const attended = b.attendanceStatus === 'present';
                                const absent = b.attendanceStatus === 'absent';
                                return (
                                    <div key={b.bookingId} className="px-6 py-4 flex items-start gap-4 opacity-80">
                                        <div className="flex-shrink-0 w-12 h-12 bg-secondary border border-border rounded-xl flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase">
                                                {date.toLocaleDateString('en-GB', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-black text-muted-foreground leading-none">
                                                {date.getDate()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="font-bold text-white text-sm">
                                                    {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.className}`}>
                                                    {cfg.label}
                                                </span>
                                                {attended && <span title="Attended"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></span>}
                                                {absent && <span title="Absent"><XCircle className="w-3.5 h-3.5 text-rose-400" /></span>}
                                            </div>
                                            <p className="text-xs text-on-surface-variant flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {b.centreName}
                                            </p>
                                            {b.bookingConfirmationCode && (
                                                <p className="text-xs font-mono font-bold text-primary/40 mt-0.5">#{b.bookingConfirmationCode}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Medical & Dietary Notes */}
                <section className="bg-card p-6 rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/10 pb-4">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        <h2 className="text-lg font-bold text-foreground">Medical & Dietary Needs</h2>
                    </div>

                    <div className="space-y-4">
                        {child.notes.length === 0 ? (
                            <div className="bg-secondary/40 p-6 rounded-xl border border-dashed border-outline-variant/20 text-center">
                                <p className="text-sm text-on-surface-variant">No medical or dietary notes on file.</p>
                            </div>
                        ) : (
                            child.notes.map(note => (
                                <div key={note.id} className="bg-secondary/40 p-4 rounded-xl border border-outline-variant/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${note.category === 'Medical' || note.category === 'Safeguarding' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
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
