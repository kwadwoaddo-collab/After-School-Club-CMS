import { getCurrentParent } from '@/lib/parent-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center bg-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                            {parent.firstName[0]}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">{parent.firstName}'s Portal</h1>
                            <p className="text-xs text-gray-500">{parent.email}</p>
                        </div>
                    </div>
                    <button className="text-sm text-gray-500 hover:text-gray-900">
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                {/* Children Section */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">My Children</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parent.children.map(child => (
                            <div key={child.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{child.firstName} {child.lastName}</h3>
                                    <p className="text-sm text-gray-500">{child.schoolYear}</p>
                                </div>
                                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-xl">
                                    👶
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Upcoming Bookings */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Upcoming Sessions</h2>
                        {/* Note: We'd need a way to know WHICH usage/centre to book for. 
                            For now, relying on them knowing the link or listing centres from previous bookings. */}
                    </div>

                    {upcomingBookings.length === 0 ? (
                        <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center">
                            <p className="text-gray-500 mb-2">No upcoming sessions booked.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingBookings.map(booking => (
                                <div key={booking.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex flex-col items-center justify-center font-bold border border-indigo-100">
                                            <span className="text-xs uppercase">{new Date(booking.startAt).toLocaleString('en-GB', { month: 'short' })}</span>
                                            <span className="text-lg leading-none">{new Date(booking.startAt).getDate()}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-gray-900">
                                                    {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : 'Tuition Session'}
                                                </h3>
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                    Confirmed
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} • {booking.duration} mins • {booking.modality === 'online' ? 'Online' : 'In Person'}
                                            </p>
                                            <p className="text-xs text-indigo-600 font-medium mt-1">
                                                📍 {(booking as any).centre?.name || 'Centre'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {booking.modality === 'online' && (
                                            <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
                                                Join Call
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
                                                        className="px-4 py-2 bg-white border border-gray-200 text-indigo-600 text-sm font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
                                                    >
                                                        Reschedule
                                                    </Link>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
                                            Details
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Past Bookings */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 opacity-75">Past Sessions</h2>
                    <div className="space-y-4 opacity-75">
                        {pastBookings.slice(0, 3).map(booking => (
                            <div key={booking.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                                <div className="flex gap-4 items-center">
                                    <span className="text-gray-500 font-mono text-sm">
                                        {new Date(booking.startAt).toLocaleDateString()}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                        {(booking as any).centre?.name}
                                    </span>
                                </div>
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Completed</span>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
