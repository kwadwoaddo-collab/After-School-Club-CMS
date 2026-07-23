/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentParent } from '@/lib/parent-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    CalendarCheck, CalendarPlus, Users, ChevronRight, Clock,
    MapPin, Video, ArrowRight, LogOut
} from 'lucide-react';
import { CancelBookingButton } from '@/features/portal/components/CancelBookingButton';
import NotificationBell from '@/features/portal/components/NotificationBell';
import { getNotifications } from '@/app/portal/notifications/actions';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function PortalDashboard() {
    const parent = await getCurrentParent();

    if (!parent) {
        redirect('/portal/login');
    }

    const notifications = await getNotifications();
    const unreadCount = notifications.filter(n => !n.readAt).length;

    const parentInvoices = await db.query.invoices.findMany({
        where: eq(invoices.parentId, parent.id),
        with: { payments: true }
    });
    const outstandingInvoices = parentInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'draft');
    const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
        const paidAmount = inv.payments?.reduce((acc, p) => p.status === 'verified' ? acc + Number(p.amount) : acc, 0) || 0;
        return sum + (Number(inv.amount) - paidAmount);
    }, 0);

    // Sort bookings
    const allBookings = parent.bookings || [];
    const upcomingBookings = allBookings
        .filter(b => new Date(b.startAt) >= new Date())
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const pastBookings = allBookings
        .filter(b => new Date(b.startAt) < new Date())
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    return (
        <div className="min-h-screen bg-surface text-on-surface pb-12">
            {/* Header */}
            <header className="bg-card border-b border-outline-variant/10 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                            {parent.firstName[0]}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-foreground">{parent.firstName}&apos;s Portal</h1>
                            <p className="text-xs text-on-surface-variant">{parent.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/portal/billing" className="text-sm font-bold text-primary hover:text-primary-dim transition-colors bg-primary/10 px-4 py-2 rounded-lg border border-primary/20 hover:border-primary/40">
                            Billing & Vouchers
                        </Link>
                        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
                        <a
                            href="/api/portal/logout"
                            className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-card"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </a>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                {totalOutstanding > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-2xl px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-destructive">£{totalOutstanding.toFixed(2)}</span>
                            <span className="text-sm font-semibold text-destructive">Overdue Balance</span>
                        </div>
                        <Link href="/portal/billing" className="bg-destructive text-white rounded-xl px-4 py-2.5 text-sm font-bold">
                            Pay Now →
                        </Link>
                    </div>
                )}

                {/* Quick Actions */}
                <section className={totalOutstanding > 0 ? "opacity-70" : ""}>
                    <Link
                        href="/portal/book"
                        className="flex items-center gap-4 bg-primary/10 border border-primary/30 hover:border-primary/60 hover:bg-primary/20 transition-all p-5 rounded-2xl group"
                    >
                        <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center border border-primary/30 group-hover:bg-primary/30 transition-colors shrink-0">
                            <CalendarPlus className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-bold text-foreground text-lg">Book a Session</h2>
                            <p className="text-sm text-on-surface-variant">Reserve a new slot for your child — no payment needed now.</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-primary opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </Link>
                </section>

                {/* Children Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-foreground">My Children</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parent.children.map(child => (
                            <Link key={child.id} href={`/portal/children/${child.id}`} className="bg-card p-6 rounded-xl border border-outline-variant/10 flex items-center justify-between hover:border-primary/20 transition-all group cursor-pointer block">
                                <div>
                                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{child.firstName} {child.lastName}</h3>
                                    <p className="text-sm text-on-surface-variant">{child.schoolYear}</p>
                                </div>
                                <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center font-bold border border-secondary/20">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Upcoming Bookings */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-secondary" />
                            <h2 className="text-xl font-bold text-foreground">Upcoming Sessions</h2>
                        </div>
                        {/* Note: We'd need a way to know WHICH usage/centre to book for. 
                            For now, relying on them knowing the link or listing centres from previous bookings. */}
                    </div>

                    {upcomingBookings.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-dashed border-outline-variant/20 text-center">
                            <p className="text-on-surface-variant mb-2">No upcoming sessions booked.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingBookings.map(booking => (
                                <div key={booking.id} className="bg-card p-6 rounded-xl border border-outline-variant/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-secondary/20 transition-all group">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex flex-col items-center justify-center font-bold border border-primary/20">
                                            <span className="text-xs uppercase">{new Date(booking.startAt).toLocaleString('en-GB', { month: 'short' })}</span>
                                            <span className="text-lg leading-none">{new Date(booking.startAt).getDate()}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-foreground">
                                                    {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : 'Club Session'}
                                                </h3>
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-tertiary-container/10 text-tertiary border border-tertiary/20">
                                                    Confirmed
                                                </span>
                                            </div>
                                            <p className="text-sm text-on-surface-variant flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} • {booking.duration} mins • {booking.modality === 'online' ? 'Online' : 'In Person'}
                                            </p>
                                            <p className="text-xs text-primary font-medium mt-1 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {(booking as any).centre?.name || 'Centre'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {booking.modality === 'online' && (
                                            <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary-dim transition-colors flex items-center gap-1.5">
                                                <Video className="w-3.5 h-3.5" /> Join Call
                                            </button>
                                        )}
                                        {(() => {
                                            const bookingDate = new Date(booking.startAt);
                                            const canReschedule = (bookingDate.getTime() - Date.now()) > (24 * 60 * 60 * 1000);
                                            const orgSlug = (booking as any).centre?.organisation?.slug;
                                            const centreSlug = (booking as any).centre?.slug;

                                            if (canReschedule) {
                                                return (
                                                    <>
                                                        <CancelBookingButton bookingId={booking.id} />
                                                        <Link
                                                            href={`/portal/book?reschedule=${booking.id}`}
                                                            className="px-4 py-2 bg-secondary/40 border border-outline-variant/10 text-primary text-sm font-bold rounded-lg hover:bg-card transition-colors flex items-center justify-center"
                                                        >
                                                            Reschedule
                                                        </Link>
                                                    </>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <Link href={`/portal/children/${booking.childId}`} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors min-h-[44px] flex items-center">
                                            Details ›
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Past Bookings */}
                <section>
                    <h2 className="text-xl font-bold text-foreground mb-4 opacity-60">Past Sessions</h2>
                    <div className="space-y-3 opacity-60">
                        {pastBookings.slice(0, 3).map(booking => (
                            <div key={booking.id} className="bg-secondary/40 p-4 rounded-xl border border-outline-variant/5 flex justify-between items-center">
                                <div className="flex gap-4 items-center">
                                    <span className="text-on-surface-variant font-mono text-sm">
                                        {new Date(booking.startAt).toLocaleDateString()}
                                    </span>
                                    <span className="font-medium text-on-surface-variant">
                                        {(booking as any).centre?.name}
                                    </span>
                                </div>
                                <span className="text-xs px-2 py-1 bg-tertiary-container/10 text-tertiary border border-tertiary/20 rounded-full font-bold">Completed</span>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
