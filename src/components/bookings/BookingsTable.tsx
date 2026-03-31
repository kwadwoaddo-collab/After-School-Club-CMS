'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Eye, Calendar as CalendarIcon, X, Clock, MapPin, Trash2, CheckCircle, Loader2, AlertTriangle, Shield, BookOpen, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

interface BookingsTableProps {
    bookings: any[];
}

export default function BookingsTable({ bookings: initialBookings }: BookingsTableProps) {
    const [bookings, setBookings] = useState<any[]>(initialBookings);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    // confirmDelete holds the bookingId pending permanent deletion
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // confirmCancel holds the bookingId pending cancellation
    const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    const handleReschedule = (bookingId: string) => {
        router.push(`/dashboard/bookings/${bookingId}/reschedule`);
        setActiveDropdown(null);
    };

    // Task 33: Quick status update
    const handleQuickStatus = async (bookingId: string, status: string) => {
        setUpdatingStatus(bookingId);
        setActiveDropdown(null);
        try {
            const response = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (response.ok) {
                setBookings(prev =>
                    prev.map(b => b.id === bookingId ? { ...b, status } : b)
                );
                const labels: Record<string, string> = {
                    signed_up: 'Signed-up',
                    confirmed: 'Booked',
                    completed: 'Attended',
                };
                toast(`Status updated to "${labels[status] ?? status}".`, 'success');
            } else {
                toast('Failed to update status. Please try again.', 'error');
            }
        } catch {
            toast('An error occurred. Please try again.', 'error');
        } finally {
            setUpdatingStatus(null);
        }
    };

    // Opens the branded cancel confirmation modal
    const openCancelModal = (bookingId: string) => {
        setConfirmCancel(bookingId);
        setActiveDropdown(null);
    };

    // Called when admin confirms the cancel dialog
    const handleCancelConfirm = async () => {
        if (!confirmCancel) return;
        setIsCancelling(true);
        try {
            const response = await fetch(`/api/bookings/${confirmCancel}/cancel`, {
                method: 'POST',
            });

            if (response.ok) {
                // Optimistic update — flip the status badge immediately
                setBookings(prev =>
                    prev.map(b => b.id === confirmCancel ? { ...b, status: 'cancelled' } : b)
                );
                toast('Booking cancelled successfully.', 'success');
            } else {
                toast('Failed to cancel booking. Please try again.', 'error');
            }
        } catch {
            toast('An error occurred. Please try again.', 'error');
        } finally {
            setIsCancelling(false);
            setConfirmCancel(null);
        }
    };

    // Task 6: Permanently delete a booking
    const handleDelete = async () => {
        if (!confirmDelete) return;
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/bookings/${confirmDelete}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Optimistic removal — no page refresh needed
                setBookings(prev => prev.filter(b => b.id !== confirmDelete));
                toast('Booking permanently deleted.', 'success');
            } else {
                toast('Failed to delete booking. Please try again.', 'error');
            }
        } catch {
            toast('An error occurred. Please try again.', 'error');
        } finally {
            setIsDeleting(false);
            setConfirmDelete(null);
            setActiveDropdown(null);
        }
    };

    if (bookings.length === 0) {
        return (
            <div className="rounded-3xl border border-[#2a2a2a] bg-[#1a1a1a]/50 p-16 text-center backdrop-blur-md shadow-2xl">
                <div className="w-20 h-20 bg-[#4F46E5]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-[#4F46E5]/30">
                    <CalendarIcon className="w-10 h-10 text-[#4F46E5]" />
                </div>
                <h3 className="text-2xl font-bold text-[#e5e2e1] mb-3">No bookings found</h3>
                <p className="text-[#a19d9c] max-w-md mx-auto mb-8">
                    Upcoming or past bookings will appear here once they are created.
                    Try adjusting your filters or create a new assessment booking.
                </p>
                <Link
                    href="/dashboard/bookings/new"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-2xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
                >
                    + New Assessment
                </Link>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        // DB enum: confirmed | cancelled | rescheduled | completed | pending | signed_up
        // confirmed → Booked (blue), completed → Attended (violet), signed_up → Signed-up (emerald)
        const styles: Record<string, string> = {
            confirmed:   'bg-blue-50 text-blue-700 ring-blue-600/20',
            pending:     'bg-amber-50 text-amber-700 ring-amber-600/20',
            signed_up:   'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
            completed:   'bg-violet-50 text-violet-700 ring-violet-600/20',
            cancelled:   'bg-slate-100 text-slate-600 ring-slate-600/20',
            rescheduled: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
        };
        const labels: Record<string, string> = {
            confirmed: 'Booked',
            signed_up: 'Signed-up',
            completed: 'Attended',
        };
        const label = labels[status] ?? status;

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ring-1 ${styles[status] || styles.pending}`}>
                {label}
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
            return `${child.firstName?.[0] || ''}${child.lastName?.[0] || ''}`.toUpperCase();
        }
        if (booking.child) {
            return `${booking.child.firstName?.[0] || ''}${booking.child.lastName?.[0] || ''}`.toUpperCase();
        }
        return '?';
    };

    const hasMedicalNote = (booking: any) => {
        if (booking.attendees && booking.attendees.length > 0) {
            return booking.attendees.some((a: any) => 
                a.child?.notes?.some((n: any) => n.category === 'Medical')
            );
        }
        if (booking.child && booking.child.notes) {
            return booking.child.notes.some((n: any) => n.category === 'Medical');
        }
        return false;
    };

    const getMedicalNotesContent = (booking: any) => {
        let notes: any[] = [];
        if (booking.attendees && booking.attendees.length > 0) {
            booking.attendees.forEach((a: any) => {
                if (a.child?.notes) {
                    notes = notes.concat(a.child.notes.filter((n: any) => n.category === 'Medical'));
                }
            });
        } else if (booking.child && booking.child.notes) {
            notes = booking.child.notes.filter((n: any) => n.category === 'Medical');
        }
        return notes.map(n => n.content).join('\n\n');
    };

    const hasSafeguardingNote = (booking: any) => {
        if (booking.attendees && booking.attendees.length > 0) {
            return booking.attendees.some((a: any) => 
                a.child?.notes?.some((n: any) => n.category === 'Safeguarding')
            );
        }
        if (booking.child && booking.child.notes) {
            return booking.child.notes.some((n: any) => n.category === 'Safeguarding');
        }
        return false;
    };

    const getSafeguardingNotesContent = (booking: any) => {
        let notes: any[] = [];
        if (booking.attendees && booking.attendees.length > 0) {
            booking.attendees.forEach((a: any) => {
                if (a.child?.notes) {
                    notes = notes.concat(a.child.notes.filter((n: any) => n.category === 'Safeguarding'));
                }
            });
        } else if (booking.child && booking.child.notes) {
            notes = booking.child.notes.filter((n: any) => n.category === 'Safeguarding');
        }
        return notes.map(n => n.content).join('\n\n');
    };

    return (
        <>
        {/* Cancel Confirmation Modal */}
        {confirmCancel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <X className="w-7 h-7 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Cancel Booking?</h3>
                    <p className="text-sm text-slate-500 text-center mb-6">
                        The booking will be marked as <strong>cancelled</strong>. The record will be kept for your records but no longer shown as confirmed.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setConfirmCancel(null)}
                            disabled={isCancelling}
                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-sm font-semibold text-slate-700 transition-all"
                        >
                            Keep Booking
                        </button>
                        <button
                            onClick={handleCancelConfirm}
                            disabled={isCancelling}
                            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isCancelling ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</> : 'Yes, Cancel'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* Task 6: Confirmation dialog */}
        {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <Trash2 className="w-7 h-7 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Delete Booking?</h3>
                    <p className="text-sm text-slate-500 text-center mb-6">
                        This will permanently remove the booking record. This action <strong>cannot be undone</strong>.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-sm font-semibold text-slate-700 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Yes, Delete'}
                        </button>
                    </div>
                </div>
            </div>
        )}

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
                                onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                                className="cursor-pointer hover:bg-slate-50/50 transition-colors group"
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
                                        <span className="text-xs text-slate-400 mt-1">
                                            Booked: {booking.createdAt ? format(new Date(booking.createdAt), 'dd/MM/yy') : 'N/A'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                            {getStudentInitials(booking)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                                                {getStudentNames(booking)}
                                            </span>
                                            {hasMedicalNote(booking) && (
                                                <div className="relative group/tooltip flex items-center outline-none">
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-50 border border-rose-100 cursor-help shadow-sm">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                                    </div>
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                        <div className="font-bold text-rose-300 mb-1 border-b border-rose-500/30 pb-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/>Medical / Allergy Alert</div>
                                                        {getMedicalNotesContent(booking)}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                    </div>
                                                </div>
                                            )}
                                            {hasSafeguardingNote(booking) && (
                                                <div className="relative group/tooltip flex items-center outline-none">
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 border border-blue-100 cursor-help shadow-sm">
                                                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                                                    </div>
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                        <div className="font-bold text-blue-300 mb-1 border-b border-blue-500/30 pb-1 flex items-center gap-1.5"><Shield className="w-3 h-3"/>Safeguarding Alert</div>
                                                        {getSafeguardingNotesContent(booking)}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
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
                                            suppressHydrationWarning
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveDropdown(activeDropdown === booking.id ? null : booking.id);
                                            }}
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
                                                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-20">
                                                    <Link
                                                        href={`/dashboard/bookings/${booking.id}`}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View Details
                                                    </Link>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReschedule(booking.id); }}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors w-full text-left"
                                                    >
                                                        <CalendarIcon className="w-4 h-4" />
                                                        Reschedule
                                                    </button>
                                                    {/* Task 33: Quick status updates */}
                                                    <div className="mx-3 my-1 border-t border-slate-100" />
                                                    <p className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Status</p>
                                                    <button
                                                        onClick={() => handleQuickStatus(booking.id, 'confirmed')}
                                                        disabled={updatingStatus === booking.id}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-blue-50 text-sm font-medium text-blue-700 transition-colors w-full text-left disabled:opacity-50"
                                                    >
                                                        <BookOpen className="w-4 h-4" />
                                                        Mark as Booked
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickStatus(booking.id, 'signed_up')}
                                                        disabled={updatingStatus === booking.id}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-emerald-50 text-sm font-medium text-emerald-700 transition-colors w-full text-left disabled:opacity-50"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        Mark as Signed-up
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickStatus(booking.id, 'completed')}
                                                        disabled={updatingStatus === booking.id}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-violet-50 text-sm font-medium text-violet-700 transition-colors w-full text-left disabled:opacity-50"
                                                    >
                                                        <GraduationCap className="w-4 h-4" />
                                                        Mark as Attended
                                                    </button>
                                                    <div className="mx-3 my-1 border-t border-slate-100" />
                                                    <button
                                                        onClick={() => openCancelModal(booking.id)}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-medium text-red-600 transition-colors w-full text-left"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Cancel Booking
                                                    </button>
                                                    <div className="mx-3 my-1 border-t border-slate-100" />
                                                    <button
                                                        onClick={() => { setConfirmDelete(booking.id); setActiveDropdown(null); }}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-sm font-medium text-red-700 transition-colors w-full text-left"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete Booking
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
                    <div 
                        key={booking.id} 
                        onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                        className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white text-sm font-bold">
                                    {getStudentInitials(booking)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-slate-900">
                                            {getStudentNames(booking)}
                                        </h4>
                                        {hasMedicalNote(booking) && (
                                            <div className="relative group/tooltip flex items-center">
                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 border border-rose-100">
                                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                                </div>
                                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-48 p-2.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed">
                                                    <div className="font-bold text-rose-300 mb-1">Medical Alert</div>
                                                    {getMedicalNotesContent(booking)}
                                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                                </div>
                                            </div>
                                        )}
                                        {hasSafeguardingNote(booking) && (
                                            <div className="relative group/tooltip flex items-center">
                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 border border-blue-100">
                                                    <Shield className="w-3 h-3 text-blue-600" />
                                                </div>
                                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-48 p-2.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed">
                                                    <div className="font-bold text-blue-300 mb-1">Safeguarding Alert</div>
                                                    {getSafeguardingNotesContent(booking)}
                                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
                            <div className="flex items-start gap-2 text-xs text-slate-600">
                                <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                                <div className="flex flex-col gap-0.5">
                                    <span>{booking.startAt ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}</span>
                                    <span className="text-xs text-slate-400">Booked: {booking.createdAt ? format(new Date(booking.createdAt), 'dd/MM/yy') : 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                            <Link
                                href={`/dashboard/bookings/${booking.id}`}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all"
                            >
                                <Eye className="w-4 h-4" />
                                View Details
                            </Link>
                            <button
                                suppressHydrationWarning
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDelete(booking.id);
                                }}
                                className="px-3 py-2 bg-red-50 hover:bg-red-100 rounded-xl text-red-600 transition-all"
                                title="Delete Booking"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        </>
    );
}
