/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { formatSchoolYearLabel } from '@/lib/school-year';
import { db } from '@/db';
import { children, bookings, bookingAttendees, centres } from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, ShieldAlert, FileText,
    CalendarDays, CheckCircle2, XCircle, MapPin, CalendarClock, Users,
} from 'lucide-react';
import { AddMedicalNoteForm } from '@/features/portal/components/AddMedicalNoteForm';

const PARENT_VISIBLE_NOTE_CATEGORIES = ['Medical', 'Dietary', 'Allergy', 'Health', 'Medication'] as const;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'Upcoming', className: 'bg-accent-soft text-accent border-accent/20' },
    completed: { label: 'Attended', className: 'bg-[var(--if-success-soft,#f0fdf4)] text-[var(--if-success,#166534)] border-[var(--if-success,#166534)]/20' },
    cancelled: { label: 'Cancelled', className: 'bg-danger/10 text-danger border-danger/20' },
    rescheduled: { label: 'Rescheduled', className: 'bg-warning/10 text-warning border-warning/20' },
    pending: { label: 'Pending', className: 'bg-surface-alt text-text-muted border-border' },
    signed_up: { label: 'Signed Up', className: 'bg-accent-soft text-accent border-accent/20' },
};

export default async function ChildDetailsPage(props: { params: Promise<{ id: string }> }) {
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    const { id } = await props.params;

    // Run child lookup (filtering soft-deleted records, SEC-W4-10) and booking history concurrently (FE P2-1)
    // NOTE: authorisedCollectors loaded via relations; zero secondary db.select() to preserve test mock queues (Blind Spot 4).
    const [child, attendeeRows] = await Promise.all([
        db.query.children.findFirst({
            where: and(
                eq(children.id, id),
                eq(children.parentId, parent.id),
                isNull(children.deletedAt)
            ),
            with: {
                centre: true,
                authorisedCollectors: true,
                notes: {
                    // P0 Safeguarding & internal-notes boundary:
                    // Never expose staff-authored notes (including deleted staff where userId is set NULL via FK)
                    // or Safeguarding/General/System notes to the Parent Portal.
                    where: (notes, { and, isNull, inArray, like }) => and(
                        isNull(notes.userId),
                        like(notes.authorName, '% (Parent)'),
                        inArray(notes.category, [...PARENT_VISIBLE_NOTE_CATEGORIES])
                    ),
                    orderBy: (notes, { desc }) => [desc(notes.createdAt)]
                }
            }
        }),
        db
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
            .orderBy(desc(bookings.startAt)),
    ]);

    if (!child) redirect('/portal');

    const now = new Date();
    const upcomingBookings = attendeeRows.filter(b => new Date(b.bookingStartAt) >= now && b.bookingStatus !== 'cancelled');
    const pastBookings = attendeeRows.filter(b => new Date(b.bookingStartAt) < now || b.bookingStatus === 'cancelled');

    const enrolledCentreName = (child as any).centre?.name || attendeeRows[0]?.centreName || null;
    const enrolledCentreAddress = (child as any).centre?.address || attendeeRows[0]?.centreAddress || null;
    const authorisedCollectorsList: any[] = ((child as any).authorisedCollectors ?? []);

    return (
        <div className="min-h-screen bg-page text-text pb-12">
            <header className="bg-surface border-b border-border sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/portal"
                        aria-label="Back to Parent Portal"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-surface-alt transition-colors text-text-muted hover:text-text cursor-pointer"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-bold text-text">{child.firstName} {child.lastName}</h1>
                            {enrolledCentreName && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                                    <MapPin className="w-3 h-3" aria-hidden="true" /> {enrolledCentreName}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-text-muted">
                            {formatSchoolYearLabel(child.schoolYear)} · DOB: {child.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString('en-GB') : 'Not provided'} · {attendeeRows.length} session{attendeeRows.length !== 1 ? 's' : ''} total
                            {enrolledCentreAddress ? ` · ${enrolledCentreAddress}` : ''}
                        </p>
                    </div>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                {/* Upcoming Bookings */}
                <section className="bg-surface rounded-2xl border border-border overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
                        <CalendarClock className="w-5 h-5 text-accent" aria-hidden="true" />
                        <h2 className="text-lg font-bold text-text">Upcoming Sessions</h2>
                        <span className="ml-auto text-xs font-bold text-accent bg-accent-soft border border-accent/20 px-2.5 py-1 rounded-lg tabular-nums">
                            {upcomingBookings.length}
                        </span>
                    </div>
                    {upcomingBookings.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                            <p className="text-sm text-text-muted">No upcoming sessions booked.</p>
                            <Link
                                href="/portal/book"
                                className="inline-flex items-center justify-center min-h-6 min-w-6 h-11 px-4 mt-4 text-xs font-bold rounded-xl bg-accent text-on-accent hover:opacity-90 transition-all shadow-sm cursor-pointer"
                            >
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
                                        <div className="flex-shrink-0 w-12 h-12 bg-accent-soft border border-accent/20 rounded-xl flex flex-col items-center justify-center tabular-nums">
                                            <span className="text-[10px] font-black text-accent uppercase">
                                                {date.toLocaleDateString('en-GB', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-black text-accent leading-none">
                                                {date.getDate()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="font-bold text-text text-sm">
                                                    {date.toLocaleDateString('en-GB', { weekday: 'long' })} · {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.className}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-text-muted flex items-center gap-1">
                                                <MapPin className="w-3 h-3" aria-hidden="true" /> {b.centreName}
                                                {b.centreAddress && <span className="truncate"> · {b.centreAddress}</span>}
                                            </p>
                                            <p className="text-xs text-text-muted mt-0.5 tabular-nums">
                                                {b.bookingDuration} min · {b.bookingModality === 'online' ? 'Online' : 'In Person'}
                                                {b.bookingConfirmationCode && <span className="ml-2 font-mono font-bold text-accent">#{b.bookingConfirmationCode}</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Emergency Contacts & Authorised Collectors (UX-06 / Blind Spot 4) */}
                <section className="bg-surface p-6 rounded-2xl border border-border space-y-6">
                    <div className="flex items-center gap-2 border-b border-border pb-4">
                        <Users className="w-5 h-5 text-accent" aria-hidden="true" />
                        <h2 className="text-lg font-bold text-text">Emergency Contacts &amp; Pick-up</h2>
                    </div>

                    {/* Primary Emergency Contact */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Primary Emergency Contact</h3>
                        <div className="bg-surface-alt p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <p className="font-bold text-text text-sm">{parent.firstName} {parent.lastName}</p>
                                <p className="text-xs text-text-muted">Parent / Primary Carer</p>
                            </div>
                            <div className="text-xs text-text-muted sm:text-right space-y-0.5">
                                {parent.phone && <p className="font-medium text-text tabular-nums">{parent.phone}</p>}
                                <p>{parent.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Authorised Pick-up Collectors */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Authorised Collectors</h3>
                            <span className="text-xs text-text-muted">Verified for safe collection</span>
                        </div>
                        {authorisedCollectorsList.length === 0 ? (
                            <div className="bg-surface-alt p-4 rounded-xl border border-dashed border-border text-center">
                                <p className="text-xs text-text-muted">
                                    Only the primary parent/carer is currently listed for collection. Contact your centre manager to add additional authorised collectors.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {authorisedCollectorsList.map((collector: any) => (
                                    <div key={collector.id} className="bg-surface-alt p-4 rounded-xl border border-border flex flex-col justify-between gap-2">
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-bold text-text text-sm">{collector.name}</p>
                                                {collector.collectionPassword ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--if-success-soft,#f0fdf4)] text-[var(--if-success,#166534)] border border-[var(--if-success,#166534)]/20">
                                                        Password on file
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-text-muted">No password set</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-text-muted mt-0.5">{collector.relationship || 'Authorised Collector'}</p>
                                        </div>
                                        {collector.phone && (
                                            <p className="text-xs font-medium text-text tabular-nums">{collector.phone}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Past Bookings */}
                {pastBookings.length > 0 && (
                    <section className="bg-surface rounded-2xl border border-border overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
                            <CalendarDays className="w-5 h-5 text-text-muted" aria-hidden="true" />
                            <h2 className="text-lg font-bold text-text">Past Sessions</h2>
                            <span className="ml-auto text-xs font-bold text-text-muted bg-surface-alt border border-border px-2.5 py-1 rounded-lg tabular-nums">
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
                                        <div className="flex-shrink-0 w-12 h-12 bg-surface-alt border border-border rounded-xl flex flex-col items-center justify-center tabular-nums">
                                            <span className="text-[10px] font-black text-text-muted uppercase">
                                                {date.toLocaleDateString('en-GB', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-black text-text-muted leading-none">
                                                {date.getDate()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="font-bold text-text text-sm">
                                                    {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.className}`}>
                                                    {cfg.label}
                                                </span>
                                                {attended && <span title="Attended"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></span>}
                                                {absent && <span title="Absent"><XCircle className="w-3.5 h-3.5 text-danger" /></span>}
                                            </div>
                                            <p className="text-xs text-text-muted flex items-center gap-1">
                                                <MapPin className="w-3 h-3" aria-hidden="true" /> {b.centreName}
                                            </p>
                                            {b.bookingConfirmationCode && (
                                                <p className="text-xs font-mono font-bold text-accent/60 mt-0.5">#{b.bookingConfirmationCode}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Medical & Dietary Notes */}
                <section className="bg-surface p-6 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
                        <ShieldAlert className="w-5 h-5 text-danger" aria-hidden="true" />
                        <h2 className="text-lg font-bold text-text">Medical &amp; Dietary Needs</h2>
                    </div>

                    <div className="space-y-4">
                        {child.notes.length === 0 ? (
                            <div className="bg-surface-alt p-6 rounded-xl border border-dashed border-border text-center">
                                <p className="text-sm text-text-muted">No medical or dietary notes on file.</p>
                            </div>
                        ) : (
                            child.notes.map(note => (
                                <div key={note.id} className="bg-surface-alt p-4 rounded-xl border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${note.category === 'Medical' || note.category === 'Allergy' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-accent-soft text-accent border-accent/20'}`}>
                                            {note.category}
                                        </span>
                                        <span className="text-xs text-text-muted tabular-nums">
                                            {new Date(note.createdAt).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-text whitespace-pre-wrap">{note.content}</p>
                                    <p className="text-xs text-text-muted mt-2">Added by: {note.authorName}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="text-sm font-bold text-text mb-1 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-accent" aria-hidden="true" />
                            Add New Medical Note
                        </h3>
                        <p className="text-xs text-text-muted mb-4">
                            Please provide any updates to allergies, medication, or specific needs. This information is critical for our staff.
                        </p>
                        <AddMedicalNoteForm childId={child.id} />
                    </div>
                </section>
            </main>
        </div>
    );
}