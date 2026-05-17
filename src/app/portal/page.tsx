import { getCurrentParent } from '@/lib/parent-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    CalendarCheck, Users, ChevronRight, Clock,
    MapPin, Video, ArrowRight, LogOut
} from 'lucide-react';

export default async function PortalDashboard() {
    const parent = await getCurrentParent();

    if (!parent) {
        redirect('/portal/login');
    }

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
            <header className="bg-surface-container-high border-b border-outline-variant/10 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                            {parent.firstName[0]}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">{parent.firstName}&apos;s Portal</h1>
                            <p className="text-xs text-on-surface-variant">{parent.email}</p>
                        </div>
                    </div>
                    <button className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-surface-bright">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                {/* Children Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-white">My Children</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parent.children.map(child => (
                            <div key={child.id} className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/10 flex items-center justify-between hover:border-primary/20 transition-all group">
                                <div>
                                    <h3 className="font-bold text-white">{child.firstName} {child.lastName}</h3>
                                    <p className="text-sm text-on-surface-variant">{child.schoolYear}</p>
                                </div>
                                <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center font-bold border border-secondary/20">
                                    {child.firstName[0]}{child.lastName[0]}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Upcoming Bookings */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-secondary" />
                            <h2 className="text-xl font-bold text-white">Upcoming Sessions</h2>
                        </div>
                        {/* Note: We'd need a way to know WHICH usage/centre to book for. 
                            For now, relying on them knowing the link or listing centres from previous bookings. */}
                    </div>

                    {upcomingBookings.length === 0 ? (
                        <div className="bg-surface-container-high p-8 rounded-xl border border-dashed border-outline-variant/20 text-center">
                            <p className="text-on-surface-variant mb-2">No upcoming sessions booked.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingBookings.map(booking => (
                                <div key={booking.id} className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-secondary/20 transition-all group">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex flex-col items-center justify-center font-bold border border-primary/20">
                                            <span className="text-xs uppercase">{new Date(booking.startAt).toLocaleString('en-GB', { month: 'short' })}</span>
                                            <span className="text-lg leading-none">{new Date(booking.startAt).getDate()}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-white">
                                                    {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : 'Tuition Session'}
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
                                            <button className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dim transition-colors flex items-center gap-1.5">
                                                <Video className="w-3.5 h-3.5" /> Join Call
                                            </button>
                                        )}
                                        {(() => {
                                            const bookingDate = new Date(booking.startAt);
                                            const canReschedule = (bookingDate.getTime() - Date.now()) > (24 * 60 * 60 * 1000);
                                            const orgSlug = (booking as any).centre?.organisation?.slug;
                                            const centreSlug = (booking as any).centre?.slug;

                                            if (canReschedule && orgSlug && centreSlug) {
                                                return (
                                                    <Link
                                                        href={`/book/${orgSlug}/${centreSlug}?reschedule=${booking.id}`}
                                                        className="px-4 py-2 bg-surface-container-low border border-outline-variant/10 text-primary text-sm font-bold rounded-lg hover:bg-surface-bright transition-colors"
                                                    >
                                                        Reschedule
                                                    </Link>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <button className="px-4 py-2 bg-surface-container-low border border-outline-variant/10 text-on-surface-variant text-sm font-bold rounded-lg hover:bg-surface-bright hover:text-white transition-colors flex items-center gap-1">
                                            Details <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Past Bookings */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-4 opacity-60">Past Sessions</h2>
                    <div className="space-y-3 opacity-60">
                        {pastBookings.slice(0, 3).map(booking => (
                            <div key={booking.id} className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/5 flex justify-between items-center">
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
