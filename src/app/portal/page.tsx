/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { formatSchoolYearLabel } from '@/lib/school-year';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    CalendarCheck, CalendarPlus, Users, ChevronRight, Clock,
    MapPin, ArrowRight, LogOut, AlertTriangle, CalendarClock, CreditCard
} from 'lucide-react';
import { CancelBookingButton } from '@/features/portal/components/CancelBookingButton';
import NotificationBell from '@/features/portal/components/NotificationBell';
import { getNotifications } from '@/app/portal/notifications/actions';
import { db } from '@/db';
import { invoices, bookingAttendees } from '@/db/schema';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import {
    COLLECTION_STAGE_STYLES,
    evaluateInvoiceCollectionState,
    toLondonBusinessDate,
} from '@/features/finance/domain/invoice-collection-state';

const INACTIVE_UPCOMING_STATUSES = new Set(['cancelled', 'rejected', 'rescheduled']);

export default async function PortalDashboard() {
    const parent = await getCurrentParent();

    if (!parent) {
        redirect('/portal/login');
    }

    const allBookings = parent.bookings || [];
    const bookingIds = allBookings.map(b => b.id);

    // Run independent portal home queries concurrently (FE P2-1):
    // - Notifications
    // - Genuinely outstanding invoices (excluding draft, void, paid at DB level)
    // - Booking attendee child mappings
    const [notifications, outstandingInvoices, attendeeRows] = await Promise.all([
        getNotifications(),
        db.query.invoices.findMany({
            where: and(
                eq(invoices.parentId, parent.id),
                notInArray(invoices.status, ['draft', 'void', 'paid'])
            ),
            with: {
                payments: {
                    where: (payments, { ne }) => ne(payments.status, 'reversed')
                }
            }
        }),
        bookingIds.length > 0
            ? db.query.bookingAttendees.findMany({
                where: inArray(bookingAttendees.bookingId, bookingIds),
            })
            : Promise.resolve([]),
    ]);

    const unreadCount = notifications.filter(n => !n.readAt).length;
    const todayLondonIso = toLondonBusinessDate();
    const evaluatedInvoices = outstandingInvoices.map(inv =>
        evaluateInvoiceCollectionState(inv, todayLondonIso)
    );
    const openStates = evaluatedInvoices.filter(state => state.remainingPence > 0);
    const totalOutstandingPence = openStates.reduce((sum, state) => sum + state.remainingPence, 0);
    const hasOverdue = openStates.some(state => state.stage === 'overdue');
    const hasInPeriod = openStates.some(
        state => state.stage === 'in_period' || state.stage === 'needs_checking'
    );
    const anyPendingVoucher = openStates.some(state => state.hasPendingPayment);
    const highestStage: 'overdue' | 'in_period' | 'upcoming' = hasOverdue
        ? 'overdue'
        : hasInPeriod
            ? 'in_period'
            : 'upcoming';
    const formattedOutstanding = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
    }).format(totalOutstandingPence / 100);

    // Sort bookings (DC-13: exclude cancelled/rejected/rescheduled sessions from Upcoming)
    const now = new Date();
    const upcomingBookings = allBookings
        .filter(b => new Date(b.startAt) >= now && !INACTIVE_UPCOMING_STATUSES.has(String(b.status)))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const pastBookings = allBookings
        .filter(b => new Date(b.startAt) < now)
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    // Derive the family's primary centre name(s) from enrolled children and bookings
    const familyCentreNames = Array.from(
        new Set([
            ...(parent.children || []).map((c: any) => c.centre?.name).filter(Boolean),
            ...allBookings.map((b: any) => b.centre?.name).filter(Boolean),
        ] as string[])
    );

    const childIdByBookingId = new Map(attendeeRows.map(a => [a.bookingId, a.childId]));

    return (
        <div className="min-h-screen bg-page text-text pb-12">
            {/* Header */}
            <header className="bg-surface border-b border-border sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-10 h-10 bg-accent-soft border border-accent/20 rounded-full flex items-center justify-center text-accent font-bold shrink-0">
                            {parent.firstName[0]}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base sm:text-lg font-bold text-text truncate">
                                    {parent.firstName}&apos;s Portal
                                </h1>
                                {familyCentreNames.length > 0 && (
                                    <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20 truncate max-w-[220px]">
                                        <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{familyCentreNames.join(' · ')}</span>
                                    </span>
                                )}
                            </div>
                            <p className="hidden sm:block text-xs text-text-muted truncate">{parent.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <Link
                            href="/portal/billing"
                            aria-label="Billing & Vouchers"
                            className="inline-flex items-center gap-1.5 min-h-[44px] text-xs sm:text-sm font-bold text-accent hover:text-accent/80 transition-colors bg-accent-soft px-2.5 sm:px-4 py-2 rounded-lg border border-accent/20 hover:border-accent/40 whitespace-nowrap"
                        >
                            <CreditCard className="w-4 h-4 sm:hidden shrink-0" aria-hidden="true" />
                            <span className="hidden sm:inline">Billing &amp; Vouchers</span>
                            <span className="sm:hidden">Billing</span>
                        </Link>
                        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
                        <form action="/api/portal/logout" method="POST">
                            <button
                                type="submit"
                                aria-label="Sign Out"
                                className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] min-w-[44px] text-xs sm:text-sm text-text-muted hover:text-text transition-colors px-2.5 sm:px-3 py-2 rounded-lg hover:bg-surface-alt cursor-pointer whitespace-nowrap"
                            >
                                <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span className="hidden min-[400px]:inline">Sign Out</span>
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                {totalOutstandingPence > 0 && (
                    <div
                        className={`rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${COLLECTION_STAGE_STYLES[highestStage].badge}`}
                    >
                        <div className="flex items-start gap-3">
                            {hasOverdue ? (
                                <AlertTriangle className="w-5 h-5 mt-1 shrink-0" aria-hidden="true" />
                            ) : hasInPeriod ? (
                                <Clock className="w-5 h-5 mt-1 shrink-0" aria-hidden="true" />
                            ) : (
                                <CalendarClock className="w-5 h-5 mt-1 shrink-0" aria-hidden="true" />
                            )}
                            <div>
                                <div className="flex flex-wrap items-baseline gap-2.5">
                                    <span className="text-2xl font-bold tabular-nums">
                                        {formattedOutstanding}
                                    </span>
                                    <span className="text-sm font-semibold">
                                        {hasOverdue
                                            ? 'Overdue Balance · Past assessment period'
                                            : hasInPeriod
                                                ? 'Assessment Period Balance · Payment due'
                                                : 'Upcoming Invoice · Issued in advance'}
                                    </span>
                                </div>
                                {anyPendingVoucher && (
                                    <p className={`text-xs font-medium mt-1 ${COLLECTION_STAGE_STYLES[highestStage].text}`}>
                                        Voucher / Tax-Free Childcare payment logged — awaiting centre verification
                                    </p>
                                )}
                            </div>
                        </div>
                        {hasOverdue ? (
                            <Link
                                href="/portal/billing"
                                className="inline-flex items-center justify-center bg-rose-700 hover:bg-rose-800 text-white rounded-xl px-4 py-2.5 text-sm font-bold transition-colors shrink-0"
                            >
                                Review &amp; Pay
                            </Link>
                        ) : hasInPeriod ? (
                            <Link
                                href="/portal/billing"
                                className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-accent-foreground rounded-xl px-4 py-2.5 text-sm font-bold transition-colors shrink-0"
                            >
                                View &amp; Pay
                            </Link>
                        ) : (
                            <Link
                                href="/portal/billing"
                                className="inline-flex items-center justify-center bg-sky-800 hover:bg-sky-900 text-white dark:bg-sky-200 dark:text-sky-950 dark:hover:bg-sky-100 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors shrink-0"
                            >
                                View Invoice
                            </Link>
                        )}
                    </div>
                )}

                {/* Quick Actions */}
                <section className={hasOverdue ? "opacity-80" : ""}>
                    {hasOverdue && (
                        <div className="mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/20">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span>Overdue balance on account · Please settle past invoices to keep active session slots</span>
                            </span>
                        </div>
                    )}
                    <Link
                        href="/portal/book"
                        className="flex items-center gap-4 bg-accent-soft border border-accent/30 hover:border-accent/60 hover:bg-accent-soft transition-all p-5 rounded-2xl group"
                    >
                        <div className="w-12 h-12 bg-accent-soft text-accent rounded-xl flex items-center justify-center border border-accent/30 group-hover:bg-accent-soft transition-colors shrink-0">
                            <CalendarPlus className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-bold text-text text-lg">Book a Session</h2>
                            <p className="text-sm text-text-muted">Reserve a new slot for your child — no payment needed now.</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-accent opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" aria-hidden="true" />
                    </Link>
                </section>

                {/* Children Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-accent" aria-hidden="true" />
                        <h2 className="text-xl font-bold text-text">My Children</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parent.children.map(child => (
                            <Link key={child.id} href={`/portal/children/${child.id}`} className="bg-surface p-6 rounded-xl border border-border flex items-center justify-between hover:border-accent/30 transition-all group cursor-pointer block">
                                <div>
                                    <h3 className="font-bold text-text group-hover:text-accent transition-colors">{child.firstName} {child.lastName}</h3>
                                    <p className="text-sm text-text-muted">{formatSchoolYearLabel(child.schoolYear)}</p>
                                    {(child as any).centre?.name && (
                                        <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                                            <MapPin className="w-3 h-3" aria-hidden="true" /> {(child as any).centre.name}
                                        </span>
                                    )}
                                </div>
                                <div className="w-10 h-10 bg-surface-alt text-text rounded-lg flex items-center justify-center font-bold border border-border shrink-0">
                                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Upcoming Bookings */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-accent" aria-hidden="true" />
                            <h2 className="text-xl font-bold text-text">Upcoming Sessions</h2>
                        </div>
                    </div>

                    {upcomingBookings.length === 0 ? (
                        <div className="bg-surface p-8 rounded-2xl border border-dashed border-border text-center">
                            <p className="text-text-muted mb-3 text-sm">No upcoming sessions booked.</p>
                            <Link
                                href="/portal/book"
                                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-sm hover:opacity-90 transition-all shadow-sm cursor-pointer"
                            >
                                Book a session →
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingBookings.map(booking => {
                                const bookingChildId = childIdByBookingId.get(booking.id);
                                return (
                                    <div key={booking.id} className="bg-surface p-6 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-accent/30 transition-all group">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-accent-soft text-accent rounded-xl flex flex-col items-center justify-center font-bold border border-accent/20 tabular-nums">
                                                <span className="text-xs uppercase">{new Date(booking.startAt).toLocaleString('en-GB', { month: 'short' })}</span>
                                                <span className="text-lg leading-none">{new Date(booking.startAt).getDate()}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-text">
                                                        {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : 'Club Session'}
                                                    </h3>
                                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                                        booking.status === 'pending'
                                                            ? COLLECTION_STAGE_STYLES.in_period.badge
                                                            : COLLECTION_STAGE_STYLES.paid.badge
                                                    }`}>
                                                        {booking.status === 'pending' ? 'Pending' : 'Confirmed'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-text-muted flex items-center gap-1.5 tabular-nums">
                                                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                    {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {booking.duration} mins · In Person
                                                </p>
                                                <p className="text-xs text-accent font-medium mt-1 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" aria-hidden="true" /> {(booking as any).centre?.name || 'Centre'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {(() => {
                                                const bookingDate = new Date(booking.startAt);
                                                const canReschedule = (bookingDate.getTime() - Date.now()) > (24 * 60 * 60 * 1000);

                                                if (canReschedule) {
                                                    return (
                                                        <>
                                                            <CancelBookingButton bookingId={booking.id} />
                                                            <Link
                                                                href={`/portal/book?reschedule=${booking.id}`}
                                                                className="min-h-[44px] px-4 py-2 bg-surface-alt/40 border border-border text-accent text-sm font-bold rounded-lg hover:bg-surface-alt transition-colors flex items-center justify-center"
                                                            >
                                                                Reschedule
                                                            </Link>
                                                        </>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            {bookingChildId && (
                                                <Link
                                                    href={`/portal/children/${bookingChildId}`}
                                                    className="text-xs font-bold text-accent hover:text-accent/80 transition-colors min-h-[44px] px-2 flex items-center gap-1"
                                                >
                                                    <span>Details</span>
                                                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Past Bookings */}
                <section>
                    <h2 className="text-xl font-bold text-text mb-4">Past Sessions</h2>
                    <div className="space-y-3">
                        {pastBookings.slice(0, 3).map(booking => (
                            <div key={booking.id} className="bg-surface-alt/40 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <div className="flex gap-4 items-center flex-wrap min-w-0">
                                    <span className="text-text-muted font-mono text-sm tabular-nums">
                                        {new Date(booking.startAt).toLocaleDateString('en-GB')}
                                    </span>
                                    <span className="font-medium text-text-muted">
                                        {(booking as any).centre?.name}
                                    </span>
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                    booking.status === 'cancelled'
                                        ? COLLECTION_STAGE_STYLES.void.badge
                                        : COLLECTION_STAGE_STYLES.paid.badge
                                }`}>
                                    {booking.status === 'cancelled'
                                        ? 'Cancelled'
                                        : booking.status === 'did_not_attend'
                                        ? 'Did Not Attend'
                                        : 'Completed'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
