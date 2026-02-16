'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Eye, Calendar as CalendarIcon, X, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BookingsTableProps {
    bookings: any[];
}

export default function BookingsTable({ bookings }: BookingsTableProps) {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const router = useRouter();

    const handleReschedule = (bookingId: string) => {
        // Navigate to reschedule page (we'll create this)
        router.push(`/dashboard/bookings/${bookingId}/reschedule`);
        setActiveDropdown(null);
    };

    const handleCancel = async (bookingId: string) => {
        if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
                method: 'POST',
            });

            if (response.ok) {
                router.refresh();
                setActiveDropdown(null);
            } else {
                alert('Failed to cancel booking. Please try again.');
            }
        } catch (error) {
            console.error('Error canceling booking:', error);
            alert('An error occurred. Please try again.');
        }
    };

    if (bookings.length === 0) {
        return (
            <div className="glass-card rounded-[32px] p-16 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <CalendarIcon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">No bookings found</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
                    Upcoming or past bookings will appear here once they are created.
                    Try adjusting your filters or create a new assessment booking.
                </p>
                <Link
                    href="/dashboard/bookings/new"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30"
                >
                    + New Assessment
                </Link>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
            pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
            completed: 'bg-violet-50 text-violet-700 ring-violet-600/20',
            cancelled: 'bg-slate-100 text-slate-600 ring-slate-600/20',
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ring-1 ${styles[status] || styles.pending}`}>
                {status}
            </span>
        );
    };

    const getStudentNames = (booking: any) => {
        if (booking.attendees && booking.attendees.length > 0) {
            return booking.attendees.map((a: any) =>
                `${a.child?.firstName} ${a.child?.lastName}`
            ).join(', ');
        }
        if (booking.child) {
            return `${booking.child.firstName} ${booking.child.lastName}`;
        }
        return 'Unknown Student';
    };

    const getStudentInitials = (booking: any) => {
        if (booking.attendees && booking.attendees.length > 0 && booking.attendees[0].child) {
            const child = booking.attendees[0].child;
            return `${child.firstName?.[0]}${child.lastName?.[0]}`.toUpperCase();
        }
        if (booking.child) {
            return `${booking.child.firstName?.[0]}${booking.child.lastName?.[0]}`.toUpperCase();
        }
        return '?';
    };

    return (
        <div className="glass-card rounded-3xl overflow-hidden">
            {/* Table for Desktop */}
            <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Date & Time
                            </th>
                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Student(s)
                            </th>
                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Assessment Type
                            </th>
                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Centre
                            </th>
                            <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {bookings.map((booking) => (
                            <tr
                                key={booking.id}
                                className="hover:bg-slate-50/50 transition-colors group"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-900">
                                            {booking.startAt ? format(new Date(booking.startAt), 'EEE, MMM d') : 'N/A'}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium mt-0.5">
                                            {booking.startAt && booking.endAt
                                                ? `${format(new Date(booking.startAt), 'h:mm a')} - ${format(new Date(booking.endAt), 'h:mm a')}`
                                                : booking.startAt
                                                    ? format(new Date(booking.startAt), 'h:mm a')
                                                    : 'Time TBD'
                                            }
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white text-sm font-bold">
                                            {getStudentInitials(booking)}
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900">
                                            {getStudentNames(booking)}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary rounded-xl text-xs font-bold">
                                        {booking.assessmentType || 'Initial Assessment'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        {booking.centre?.name || 'Unknown'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(booking.status)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="relative inline-block">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === booking.id ? null : booking.id)}
                                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4 text-slate-500" />
                                        </button>

                                        {activeDropdown === booking.id && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setActiveDropdown(null)}
                                                />
                                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-20">
                                                    <Link
                                                        href={`/dashboard/bookings/${booking.id}`}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View Details
                                                    </Link>
                                                    <button
                                                        onClick={() => handleReschedule(booking.id)}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors w-full text-left"
                                                    >
                                                        <CalendarIcon className="w-4 h-4" />
                                                        Reschedule
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancel(booking.id)}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-medium text-red-600 transition-colors w-full text-left"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Cancel Booking
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Card View for Mobile */}
            <div className="lg:hidden divide-y divide-slate-100">
                {bookings.map((booking) => (
                    <div key={booking.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white text-sm font-bold">
                                    {getStudentInitials(booking)}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900">
                                        {getStudentNames(booking)}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {booking.centre?.name}
                                    </p>
                                </div>
                            </div>
                            {getStatusBadge(booking.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                {booking.startAt ? format(new Date(booking.startAt), 'MMM d, yyyy') : 'Date TBD'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {booking.startAt ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}
                            </div>
                        </div>

                        <Link
                            href={`/dashboard/bookings/${booking.id}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all"
                        >
                            <Eye className="w-4 h-4" />
                            View Details
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
