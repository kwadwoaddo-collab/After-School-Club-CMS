'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Eye, Calendar as CalendarIcon, X, Clock, MapPin, Trash2, CheckCircle, Loader2, AlertTriangle, Shield, BookOpen, GraduationCap, ChevronUp, ChevronDown, SearchX, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

import ReassignCentreModal from './ReassignCentreModal';

interface BookingsTableProps {
    bookings: any[];
    centres?: { id: string; name: string }[];
    isFiltered?: boolean;
}

type SortKey = 'date' | 'student' | 'status' | null;
type SortDirection = 'asc' | 'desc';

export default function BookingsTable({ bookings: initialBookings, centres = [], isFiltered }: BookingsTableProps) {
    const [bookings, setBookings] = useState<any[]>(initialBookings);
    
    const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
    
    // Sync external props (e.g., from server-side filtering) to internal state
    useEffect(() => {
        setBookings(initialBookings);
        // Clear bulk selections on filter change
        setSelectedBookings(new Set());
    }, [initialBookings]);

    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    // confirmDelete holds the bookingId pending permanent deletion
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // confirmCancel holds the bookingId pending cancellation
    const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
    const [reassignTarget, setReassignTarget] = useState<string | null>(null);
    
    // Sort and bulk select state
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: null, direction: 'asc' });
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    const router = useRouter();
    const { toast } = useToast();

    // Sorting Handlers
    const handleSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Bulk Action Handlers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedBookings(new Set(bookings.map(b => b.id)));
        } else {
            setSelectedBookings(new Set());
        }
    };

    const handleSelectRow = (bookingId: string) => {
        const newSet = new Set(selectedBookings);
        if (newSet.has(bookingId)) {
            newSet.delete(bookingId);
        } else {
            newSet.add(bookingId);
        }
        setSelectedBookings(newSet);
    };

    const handleBulkStatus = async (status: string) => {
        const ids = Array.from(selectedBookings);
        if (!ids.length) return;
        setIsProcessingBulk(true);
        try {
            const response = await fetch('/api/bookings/bulk-update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingIds: ids, status })
            });
            if (response.ok) {
                setBookings(prev => prev.map(b => ids.includes(b.id) ? { ...b, status } : b));
                const labels: Record<string, string> = {
                    signed_up: 'Signed-up',
                    completed: 'Attended',
                };
                toast(`Updated ${ids.length} bookings to "${labels[status] || status}".`, 'success');
                setSelectedBookings(new Set());
            } else {
                toast('Failed to update bookings.', 'error');
            }
        } catch {
            toast('An error occurred.', 'error');
        } finally {
            setIsProcessingBulk(false);
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedBookings);
        if (!ids.length) return;
        setConfirmBulkDelete(false);
        setIsProcessingBulk(true);
        try {
            const response = await fetch('/api/bookings/bulk-delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingIds: ids })
            });
            if (response.ok) {
                setBookings(prev => prev.filter(b => !ids.includes(b.id)));
                toast(`Deleted ${ids.length} bookings successfully.`, 'success');
                setSelectedBookings(new Set());
            } else {
                toast('Failed to delete bookings.', 'error');
            }
        } catch {
            toast('An error occurred.', 'error');
        } finally {
            setIsProcessingBulk(false);
        }
    };

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

    const getStatusBadge = (status: string) => {
        // DB enum: confirmed | cancelled | rescheduled | completed | pending | signed_up
        // confirmed → Booked (blue), completed → Attended (violet), signed_up → Signed-up (emerald)
        const styles: Record<string, string> = {
            confirmed:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            completed:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            signed_up:   'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            pending:     'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
            cancelled:   'bg-destructive/10 text-destructive border-destructive/20',
            rescheduled: 'bg-secondary text-muted-foreground border-border',
        };
        const labels: Record<string, string> = {
            confirmed: 'Booked',
            signed_up: 'Signed-up',
            completed: 'Attended',
        };
        const label = labels[status] ?? status;

        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${styles[status] || styles.pending}`}>
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

    // Returns structured list for rendering — first name + overflow count
    const getStudentList = (booking: any): { first: string; rest: string[]; firstId?: string } => {
        if (booking.attendees && booking.attendees.length > 0) {
            const all = booking.attendees.map((a: any) => ({
                name: `${a.child?.firstName || ''} ${a.child?.lastName || ''}`.trim(),
                id: a.child?.id,
            }));
            return {
                first: all[0]?.name || 'Unknown',
                firstId: all[0]?.id,
                rest: all.slice(1).map((s: { name: string; id: string }) => s.name),
            };
        }
        if (booking.child) {
            return {
                first: `${booking.child.firstName || ''} ${booking.child.lastName || ''}`.trim(),
                firstId: booking.child.id,
                rest: [],
            };
        }
        return { first: 'Unknown Student', rest: [] };
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

    // Calculate Sorted Bookings
    const sortedBookings = [...bookings].sort((a, b) => {
        if (!sortConfig.key) return 0;
        let aValue: any;
        let bValue: any;
        
        if (sortConfig.key === 'date') {
            aValue = new Date(a.startAt || 0).getTime();
            bValue = new Date(b.startAt || 0).getTime();
        } else if (sortConfig.key === 'student') {
            aValue = getStudentNames(a).toLowerCase();
            bValue = getStudentNames(b).toLowerCase();
        } else if (sortConfig.key === 'status') {
            aValue = a.status;
            bValue = b.status;
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (bookings.length === 0) {
        if (isFiltered) {
        return (
            <div className="rounded-3xl border border-border bg-card/50 p-16 text-center shadow-sm">
                <div className="w-20 h-20 bg-secondary border border-border rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <SearchX className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">No results found</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    We couldn&apos;t find any bookings matching your current filters. Try adjusting your search term, centre, or status.
                </p>
                <button
                    onClick={() => router.push('/dashboard/bookings')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-2xl text-sm font-bold transition-all border border-border shadow-sm"
                >
                    Clear All Filters
                </button>
            </div>
        );
        }

        return (
            <div className="rounded-3xl border border-border bg-card/50 p-16 text-center shadow-sm">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-primary/30">
                    <CalendarIcon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">No bookings found</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Upcoming or past bookings will appear here once they are created.
                    Try adjusting your filters or create a new session booking.
                </p>
                <Link
                    href="/dashboard/bookings/new"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/25"
                >
                    + Book Session
                </Link>
            </div>
        );
    }

    return (
        <>
        {/* Cancel Confirmation Modal */}
        {confirmCancel && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-dialog-title"
            >
                <div className="bg-popover border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-amber-500/30">
                        <X className="w-7 h-7 text-amber-700 dark:text-amber-400" />
                    </div>
                    <h3 id="cancel-dialog-title" className="text-lg font-bold text-foreground text-center mb-2">Cancel Booking?</h3>
                    <p className="text-sm text-muted-foreground text-center mb-6">
                        The booking will be marked as <strong className="text-foreground">cancelled</strong>. The record will be kept for your records but no longer shown as confirmed.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setConfirmCancel(null)}
                            disabled={isCancelling}
                        className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-semibold text-foreground transition-all border border-border"
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
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
            >
                <div className="bg-popover border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-red-500/30">
                        <Trash2 className="w-7 h-7 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 id="delete-dialog-title" className="text-lg font-bold text-foreground text-center mb-2">Delete Booking?</h3>
                    <p className="text-sm text-muted-foreground text-center mb-6">
                        This will permanently remove the booking record. This action <strong className="text-foreground">cannot be undone</strong>.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-semibold text-foreground transition-all border border-border"
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
        
        {/* Reassign Centre Modal */}
        {reassignTarget && (
            <ReassignCentreModal
                bookingId={reassignTarget}
                currentCentreId={bookings.find(b => b.id === reassignTarget)?.centreId || ''}
                centres={centres}
                onClose={() => setReassignTarget(null)}
                onSuccess={(newCentreId) => {
                    // Update the booking optimistically or force refresh
                    router.refresh();
                }}
            />
        )}

        <div className="glassmorphic-card rounded-[32px] overflow-hidden relative">
            {/* Table for Desktop */}
            <div className="hidden lg:block overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative scrollbar-thin">
                <table className="w-full table-fixed">
                    <colgroup>
                        <col className="w-12" />          {/* checkbox */}
                        <col className="w-36" />          {/* date & time */}
                        <col />                           {/* student — flex, takes remaining */}
                        <col className="w-40" />          {/* session type */}
                        <col className="w-44" />          {/* centre */}
                        <col className="w-28" />          {/* status */}
                        <col className="w-16" />          {/* actions */}
                    </colgroup>
                    <thead>
                        <tr className="border-b border-border">
                            <th className="sticky top-0 z-10 bg-card border-b border-border text-left px-5 py-4 w-12">
                                <div className="flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        checked={bookings.length > 0 && selectedBookings.size === bookings.length}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded appearance-none border border-primary/40 bg-background checked:bg-primary checked:border-primary flex items-center justify-center transition-all cursor-pointer relative checked:before:content-[''] checked:before:absolute checked:before:left-[5px] checked:before:top-[1px] checked:before:w-1.5 checked:before:h-2.5 checked:before:border-r-2 checked:before:border-b-2 checked:before:border-white checked:before:rotate-45"
                                    />
                                </div>
                            </th>
                            <th 
                                className="sticky top-0 z-10 bg-card border-b border-border text-left px-4 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-secondary/60 transition-colors group select-none whitespace-nowrap"
                                onClick={() => handleSort('date')}
                            >
                                <div className="flex items-center gap-2">
                                    Date &amp; Time
                                    <div className={`flex flex-col ml-1 ${sortConfig.key === 'date' ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'} transition-opacity`}>
                                        <ChevronUp className={`w-[10px] h-[10px] -mb-[4px] ${sortConfig.key === 'date' && sortConfig.direction === 'asc' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                                        <ChevronDown className={`w-[10px] h-[10px] ${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                                    </div>
                                </div>
                            </th>
                            <th 
                                className="sticky top-0 z-10 bg-card border-b border-border text-left px-4 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-secondary/60 transition-colors group select-none whitespace-nowrap"
                                onClick={() => handleSort('student')}
                            >
                                <div className="flex items-center gap-2">
                                    Student(s)
                                    <div className={`flex flex-col ml-1 ${sortConfig.key === 'student' ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'} transition-opacity`}>
                                        <ChevronUp className={`w-[10px] h-[10px] -mb-[4px] ${sortConfig.key === 'student' && sortConfig.direction === 'asc' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                                        <ChevronDown className={`w-[10px] h-[10px] ${sortConfig.key === 'student' && sortConfig.direction === 'desc' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                                    </div>
                                </div>
                            </th>
                            <th className="sticky top-0 z-10 bg-card border-b border-border text-left px-4 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                Session Type
                            </th>
                            <th className="sticky top-0 z-10 bg-card border-b border-border text-left px-4 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                Centre
                            </th>
                            <th 
                                className="sticky top-0 z-10 bg-card border-b border-border text-left px-4 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-secondary/60 transition-colors group select-none whitespace-nowrap"
                                onClick={() => handleSort('status')}
                            >
                                <div className="flex items-center gap-2">
                                    Status
                                    <div className={`flex flex-col ml-1 ${sortConfig.key === 'status' ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'} transition-opacity`}>
                                        <ChevronUp className={`w-[10px] h-[10px] -mb-[4px] ${sortConfig.key === 'status' && sortConfig.direction === 'asc' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                                        <ChevronDown className={`w-[10px] h-[10px] ${sortConfig.key === 'status' && sortConfig.direction === 'desc' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                                    </div>
                                </div>
                            </th>
                            <th className="sticky top-0 z-10 bg-card border-b border-border text-right px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sortedBookings.map((booking) => (
                            <tr
                                key={booking.id}
                                onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                                className={`cursor-pointer hover:bg-secondary/40 transition-colors group ${selectedBookings.has(booking.id) ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                            >
                                <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedBookings.has(booking.id)}
                                            onChange={() => handleSelectRow(booking.id)}
                                            className="w-4 h-4 rounded appearance-none border border-primary/40 bg-background checked:bg-primary checked:border-primary flex items-center justify-center transition-all cursor-pointer relative checked:before:content-[''] checked:before:absolute checked:before:left-[5px] checked:before:top-[1px] checked:before:w-1.5 checked:before:h-2.5 checked:before:border-r-2 checked:before:border-b-2 checked:before:border-white checked:before:rotate-45"
                                        />
                                    </div>
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-foreground whitespace-nowrap">
                                            {booking.startAt ? format(new Date(booking.startAt), 'EEE, MMM d') : 'N/A'}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-medium mt-0.5 whitespace-nowrap">
                                            {booking.startAt && booking.endAt
                                                ? `${format(new Date(booking.startAt), 'h:mm a')} – ${format(new Date(booking.endAt), 'h:mm a')}`
                                                : booking.startAt
                                                    ? format(new Date(booking.startAt), 'h:mm a')
                                                    : 'Time TBD'
                                            }
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                                            {getStudentInitials(booking)}
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            {(() => {
                                                const { first, rest, firstId } = getStudentList(booking);
                                                const targetId = firstId || booking.attendees?.[0]?.child?.id || booking.child?.id;
                                                const isLong = first.length > 18;
                                                return (
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Link
                                                                href={`/dashboard/students/${targetId}`}
                                                                className={`font-semibold text-foreground group-hover:text-primary transition-colors hover:underline truncate ${
                                                                    isLong ? 'text-xs' : 'text-sm'
                                                                }`}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {first}
                                                            </Link>
                                                            {rest.length > 0 && (
                                                                <div className="relative group/more flex-shrink-0">
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold cursor-default border border-border">
                                                                        +{rest.length}
                                                                    </span>
                                                                    {/* Tooltip with all extra names */}
                                                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover/more:block min-w-[160px] max-w-[220px] p-3 bg-popover border border-border rounded-2xl shadow-xl z-[60]">
                                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">All Students</p>
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-xs font-semibold text-foreground">{first}</span>
                                                                            {rest.map((name, i) => (
                                                                                <span key={i} className="text-xs font-semibold text-foreground">{name}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            {hasMedicalNote(booking) && (
                                                <div className="relative group/tooltip flex items-center outline-none flex-shrink-0">
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-50 border border-rose-100 cursor-help shadow-sm">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                                    </div>
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                        <div className="font-bold text-rose-500 mb-1 border-b border-rose-500/30 pb-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/>Medical / Allergy Alert</div>
                                                        {getMedicalNotesContent(booking)}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"></div>
                                                    </div>
                                                </div>
                                            )}
                                            {hasSafeguardingNote(booking) && (
                                                <div className="relative group/tooltip flex items-center outline-none flex-shrink-0">
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 border border-blue-100 cursor-help shadow-sm">
                                                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                                                    </div>
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                        <div className="font-bold text-blue-500 mb-1 border-b border-blue-500/30 pb-1 flex items-center gap-1.5"><Shield className="w-3 h-3"/>Safeguarding Alert</div>
                                                        {getSafeguardingNotesContent(booking)}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"></div>
                                                    </div>
                                                </div>
                                            )}
                                            {(booking.parent?.email || booking.parent?.phone) && (
                                                <div className="flex items-center gap-1.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    {booking.parent.email && (
                                                        <a
                                                            href={`mailto:${booking.parent.email}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                                            title={`Email ${booking.parent.firstName}`}
                                                        >
                                                            <Mail className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                    {booking.parent.phone && (
                                                        <a
                                                            href={`tel:${booking.parent.phone}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                                            title={`Call ${booking.parent.firstName}`}
                                                        >
                                                            <Phone className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3.5">
                                    <span className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary rounded-xl text-xs font-bold whitespace-nowrap">
                                        {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : booking.assessmentType === 'progress_review' ? 'Progress Check' : 'Activity'}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                                        <span className="truncate">{booking.centre?.name || 'Unknown'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3.5">
                                    {getStatusBadge(booking.status)}
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                    <div className="relative inline-block">
                                        <button
                                            suppressHydrationWarning
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveDropdown(activeDropdown === booking.id ? null : booking.id);
                                            }}
                                            className="p-2 hover:bg-secondary rounded-xl transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                        </button>
 
                                        {activeDropdown === booking.id && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }}
                                                />
                                                <div className="absolute right-0 top-full mt-2 w-52 bg-popover/90 backdrop-blur-md rounded-2xl shadow-xl border border-border py-2 z-20">
                                                    <Link
                                                        href={`/dashboard/bookings/${booking.id}`}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/60 text-sm font-medium text-foreground transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View Details
                                                    </Link>
                                                    {(booking.attendees?.[0]?.child?.id || booking.child?.id) && (
                                                        <Link
                                                            href={`/dashboard/students/${booking.attendees?.[0]?.child?.id || booking.child?.id}`}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-primary transition-colors"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            View Student Profile
                                                        </Link>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReschedule(booking.id); }}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-foreground transition-colors w-full text-left"
                                                    >
                                                        <CalendarIcon className="w-4 h-4" />
                                                        Reschedule
                                                    </button>
                                                    {centres.length > 1 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setReassignTarget(booking.id); setActiveDropdown(null); }}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-foreground transition-colors w-full text-left"
                                                        >
                                                            <MapPin className="w-4 h-4 text-indigo-500" />
                                                            Reassign Centre
                                                        </button>
                                                    )}
                                                    {/* Task 33: Quick status updates */}
                                                    <div className="mx-3 my-1 border-t border-border" />
                                                    <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quick Status</p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'confirmed'); }}
                                                        disabled={updatingStatus === booking.id}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-blue-500 transition-colors w-full text-left disabled:opacity-50"
                                                    >
                                                        <BookOpen className="w-4 h-4" />
                                                        Mark as Booked
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'signed_up'); }}
                                                        disabled={updatingStatus === booking.id}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-emerald-500 transition-colors w-full text-left disabled:opacity-50"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        Mark as Signed-up
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'completed'); }}
                                                        disabled={updatingStatus === booking.id}
                                                        title="Marks entire booking as attended (applies to all children)"
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-violet-500 transition-colors w-full text-left disabled:opacity-50"
                                                    >
                                                        <GraduationCap className="w-4 h-4" />
                                                        Mark as Attended
                                                    </button>
                                                    <div className="mx-3 my-1 border-t border-border" />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openCancelModal(booking.id); }}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-sm font-medium text-red-500 transition-colors w-full text-left"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Cancel Booking
                                                    </button>
                                                    <div className="mx-3 my-1 border-t border-border" />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(booking.id); setActiveDropdown(null); }}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-sm font-medium text-red-600 transition-colors w-full text-left"
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
            <div className="lg:hidden divide-y divide-border">
                {/* Simplified Mobile Select All */}
                <div className="p-4 bg-secondary/30 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            checked={bookings.length > 0 && selectedBookings.size === bookings.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded appearance-none border border-primary/40 bg-background checked:bg-primary checked:border-primary flex items-center justify-center transition-all cursor-pointer relative checked:before:content-[''] checked:before:absolute checked:before:left-[5px] checked:before:top-[1px] checked:before:w-1.5 checked:before:h-2.5 checked:before:border-r-2 checked:before:border-b-2 checked:before:border-white checked:before:rotate-45"
                        />
                        <span className="text-sm font-bold text-foreground">Select All</span>
                    </div>
                </div>
                {sortedBookings.map((booking) => (
                    <div 
                        key={booking.id} 
                        onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                        className={`p-5 cursor-pointer hover:bg-secondary/40 transition-colors ${selectedBookings.has(booking.id) ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div onClick={(e) => e.stopPropagation()} className="pt-1">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBookings.has(booking.id)}
                                        onChange={() => handleSelectRow(booking.id)}
                                        className="w-4 h-4 rounded appearance-none border border-primary/40 bg-background checked:bg-primary checked:border-primary flex items-center justify-center transition-all cursor-pointer relative checked:before:content-[''] checked:before:absolute checked:before:left-[5px] checked:before:top-[1px] checked:before:w-1.5 checked:before:h-2.5 checked:before:border-r-2 checked:before:border-b-2 checked:before:border-white checked:before:rotate-45"
                                    />
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white text-sm font-bold">
                                    {getStudentInitials(booking)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Link 
                                            href={`/dashboard/students/${booking.attendees?.[0]?.child?.id || booking.child?.id}`}
                                            className="text-sm font-bold text-foreground hover:text-primary hover:underline transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {getStudentNames(booking)}
                                        </Link>
                                        {hasMedicalNote(booking) && (
                                            <div className="relative group/tooltip flex items-center">
                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 border border-rose-100">
                                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                                </div>
                                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-48 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed">
                                                    <div className="font-bold text-rose-500 mb-1">Medical Alert</div>
                                                    {getMedicalNotesContent(booking)}
                                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-border"></div>
                                                </div>
                                            </div>
                                        )}
                                        {hasSafeguardingNote(booking) && (
                                            <div className="relative group/tooltip flex items-center">
                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 border border-blue-100">
                                                    <Shield className="w-3 h-3 text-blue-600" />
                                                </div>
                                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-48 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed">
                                                    <div className="font-bold text-blue-500 mb-1">Safeguarding Alert</div>
                                                    {getSafeguardingNotesContent(booking)}
                                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-border"></div>
                                                </div>
                                            </div>
                                        )}
                                        {(booking.parent?.email || booking.parent?.phone) && (
                                            <div className="flex items-center gap-1.5 ml-1">
                                                {booking.parent.email && (
                                                    <a 
                                                        href={`mailto:${booking.parent.email}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        <Mail className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {booking.parent.phone && (
                                                    <a 
                                                        href={`tel:${booking.parent.phone}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        <Phone className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                        {booking.centre?.name}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {getStatusBadge(booking.status)}
                                <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        suppressHydrationWarning
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdown(activeDropdown === `mobile-${booking.id}` ? null : `mobile-${booking.id}`);
                                        }}
                                        className="p-1.5 hover:bg-secondary rounded-lg transition-colors -mr-1"
                                    >
                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    
                                    {activeDropdown === `mobile-${booking.id}` && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }}
                                            />
                                            <div className="absolute right-0 top-full mt-2 w-52 bg-popover/90 backdrop-blur-md rounded-2xl shadow-xl border border-border py-2 z-20">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleReschedule(booking.id); }}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-foreground transition-colors w-full text-left"
                                                >
                                                    <CalendarIcon className="w-4 h-4" />
                                                    Reschedule
                                                </button>
                                                {centres.length > 1 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReassignTarget(booking.id); setActiveDropdown(null); }}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-foreground transition-colors w-full text-left"
                                                    >
                                                        <MapPin className="w-4 h-4 text-indigo-500" />
                                                        Reassign Centre
                                                    </button>
                                                )}
                                                <div className="mx-3 my-1 border-t border-border" />
                                                <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quick Status</p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'confirmed'); }}
                                                    disabled={updatingStatus === booking.id}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-blue-500 transition-colors w-full text-left disabled:opacity-50"
                                                >
                                                    <BookOpen className="w-4 h-4" />
                                                    Mark as Booked
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'signed_up'); }}
                                                    disabled={updatingStatus === booking.id}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-emerald-500 transition-colors w-full text-left disabled:opacity-50"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Mark as Signed-up
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'completed'); }}
                                                    disabled={updatingStatus === booking.id}
                                                    title="Marks entire booking as attended (applies to all children)"
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-secondary text-sm font-medium text-violet-500 transition-colors w-full text-left disabled:opacity-50"
                                                >
                                                    <GraduationCap className="w-4 h-4" />
                                                    Mark as Attended
                                                </button>
                                                <div className="mx-3 my-1 border-t border-border" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openCancelModal(booking.id); }}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-sm font-medium text-red-500 transition-colors w-full text-left"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Cancel Booking
                                                </button>
                                                <div className="mx-3 my-1 border-t border-border" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(booking.id); setActiveDropdown(null); }}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-sm font-medium text-red-600 transition-colors w-full text-left"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete Booking
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3 pl-8">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CalendarIcon className="w-4 h-4 text-muted-foreground/60" />
                                {booking.startAt ? format(new Date(booking.startAt), 'MMM d, yyyy') : 'Date TBD'}
                            </div>
                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Clock className="w-4 h-4 text-muted-foreground/60 mt-0.5" />
                                <div className="flex flex-col gap-0.5">
                                    <span>{booking.startAt ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex mt-3 pl-8">
                            <Link
                                href={`/dashboard/bookings/${booking.id}`}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-semibold text-foreground transition-all border border-border"
                            >
                                <Eye className="w-4 h-4" />
                                View Details
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Floating Action Bar */}
        <div 
            className={`fixed bottom-0 left-0 right-0 z-[100] flex justify-center pb-6 transition-all duration-300 ${
                selectedBookings.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
            }`}
        >
            <div className="bg-popover/90 backdrop-blur-md border border-border shadow-xl rounded-2xl p-2 px-3 flex items-center gap-4 mx-4">
                <div className="pl-2 pr-4 py-2 border-r border-border flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs ring-1 ring-primary/30">
                        {selectedBookings.size}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pr-1">
                    <button
                        onClick={() => handleBulkStatus('completed')}
                        disabled={isProcessingBulk}
                        title="Marks selected bookings as attended (applies to all children in each booking)"
                        className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-xl text-sm font-semibold transition-all whitespace-nowrap disabled:opacity-50"
                    >
                        {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                        Mark as Attended
                    </button>
                    <button
                        onClick={() => handleBulkStatus('signed_up')}
                        disabled={isProcessingBulk}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-semibold transition-all whitespace-nowrap disabled:opacity-50"
                    >
                        {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Mark Signed-up
                    </button>
                    <div className="w-px h-6 bg-border/30 mx-1"></div>
                    <button
                        onClick={() => setConfirmBulkDelete(true)}
                        disabled={isProcessingBulk}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-semibold transition-all whitespace-nowrap disabled:opacity-50"
                    >
                        {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>

        {/* Bulk Delete Confirmation Modal */}
        {confirmBulkDelete && (
            <div
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bulk-delete-dialog-title"
            >
                <div className="bg-popover/90 backdrop-blur-md border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-destructive/20">
                        <Trash2 className="w-7 h-7 text-destructive" />
                    </div>
                    <h3 id="bulk-delete-dialog-title" className="text-lg font-bold text-foreground text-center mb-2">
                        Delete {selectedBookings.size} Booking{selectedBookings.size !== 1 ? 's' : ''}?
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-6">
                        This will permanently remove <strong className="text-foreground">{selectedBookings.size} booking{selectedBookings.size !== 1 ? 's' : ''}</strong>. This action <strong className="text-foreground">cannot be undone</strong>.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setConfirmBulkDelete(false)}
                            className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-semibold text-foreground transition-all border border-border"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-2xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Delete All
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
