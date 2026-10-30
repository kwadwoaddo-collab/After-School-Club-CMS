/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { formatSchoolYearLabel } from '@/lib/school-year';
import { db } from '@/db';
import { children, bookings, bookingAttendees, centres } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, ShieldAlert, FileText,
    CalendarDays, CheckCircle2, XCircle, MapPin, CalendarClock,
} from 'lucide-react';
import { AddMedicalNoteForm } from '@/features/portal/components/AddMedicalNoteForm';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'Upcoming', className: 'bg-primary/10 text-primary border-primary/20' },
    completed: { label: 'Attended', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    rescheduled: { label: 'Rescheduled', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    pending: { label: 'Pending', className: 'bg-secondary text-muted-foreground border-border' },
    signed_up: { label: 'Signed Up', className: 'bg-primary/10 text-primary border-primary/20' },
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
            centre: true,
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

    const enrolledCentreName = (child as any).centre?.name || attendeeRows[0]?.centreName || null;
    const enrolledCentreAddress = (child as any).centre?.address || attendeeRows[0]?.centreAddress || null;

    return (
        <div className="min-h-screen bg-background text-foreground pb-12">
            <header className="bg-card border-b border-border sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/portal" className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-bold text-foreground">{child.firstName} {child.lastName}</h1>
                            {enrolledCentreName && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                    <MapPin className="w-3 h-3" /> {enrolledCentreName}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {formatSchoolYearLabel(child.schoolYear)} · DOB: {child.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString('en-GB') : 'Not provided'} · {attendeeRows.length} session{attendeeRows.length !== 1 ? 's' : ''} total
                            {enrolledCentreAddress ? ` · ${enrolledCentreAddress}` : ''}
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                {/* Upcoming Bookings */}
                <section className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
                        <CalendarClock className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Upcoming Sessions</h2>
                        <span className="ml-auto text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                            {upcomingBookings.length}
                        </span>
                    </div>
                    {upcomingBookings.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                            <p className="text-sm text-muted-foreground">No upcoming sessions booked.</p>
                            <Link href="/portal/book" className="inline-block mt-4 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                                Book a session →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
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
                                                <p className="font-bold text-foreground text-sm">
                                                    {date.toLocaleDateString('en-GB', { weekday: 'long' })} · {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.className}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {b.centreName}
                                                {b.centreAddress && <span className="truncate"> · {b.centreAddress}</span>}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
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
                    <section className="bg-card rounded-2xl border border-border overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
                            <CalendarDays className="w-5 h-5 text-muted-foreground" />
                            <h2 className="text-lg font-bold text-foreground">Past Sessions</h2>
                            <span className="ml-auto text-xs font-bold text-muted-foreground bg-secondary border border-border px-2.5 py-1 rounded-lg">
                                {pastBookings.length}
                            </span>
                        </div>
                        <div className="divide-y divide-border">
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
                                                <p className="font-bold text-foreground text-sm">
                                                    {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.className}`}>
                                                    {cfg.label}
                                                </span>
                                                {attended && <span title="Attended"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></span>}
                                                {absent && <span title="Absent"><XCircle className="w-3.5 h-3.5 text-destructive" /></span>}
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
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
                <section className="bg-card p-6 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
                        <ShieldAlert className="w-5 h-5 text-destructive" />
                        <h2 className="text-lg font-bold text-foreground">Medical & Dietary Needs</h2>
                    </div>

                    <div className="space-y-4">
                        {child.notes.length === 0 ? (
                            <div className="bg-secondary/40 p-6 rounded-xl border border-dashed border-border text-center">
                                <p className="text-sm text-muted-foreground">No medical or dietary notes on file.</p>
                            </div>
                        ) : (
                            child.notes.map(note => (
                                <div key={note.id} className="bg-secondary/40 p-4 rounded-xl border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${note.category === 'Medical' || note.category === 'Safeguarding' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                            {note.category}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(note.createdAt).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                                    <p className="text-xs text-muted-foreground mt-2">Added by: {note.authorName}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            Add New Medical Note
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Please provide any updates to allergies, medication, or specific needs. This information is critical for our staff.
                        </p>
                        <AddMedicalNoteForm childId={child.id} />
                    </div>
                </section>
            </main>
        </div>
    );
}
