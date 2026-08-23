'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Eye, Calendar as CalendarIcon, X, Clock, MapPin, Trash2, CheckCircle, Loader2, AlertTriangle, Shield, BookOpen, GraduationCap, ChevronUp, ChevronDown, SearchX, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

import ReassignCentreModal from './ReassignCentreModal';

interface BookingsTableProps {
    bookings: unknown[];
    centres?: { id: string; name: string }[];
    isFiltered?: boolean;
}

interface ChildNote {
    content: string;
    category?: string | null;
}

type SortKey = 'date' | 'student' | 'status' | null;
type SortDirection = 'asc' | 'desc';

const STATUS_LABELS: Record<string, string> = {
    confirmed: 'Booked',
    signed_up: 'Signed-up',
    completed: 'Attended',
    pending: 'Pending',
    cancelled: 'Cancelled',
    rescheduled: 'Rescheduled',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    confirmed: 'info',
    signed_up: 'success',
    completed: 'success',
    pending: 'warning',
    cancelled: 'default',
    rescheduled: 'default',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant={STATUS_VARIANTS[status] || 'default'} className={status === 'cancelled' ? 'opacity-70' : ''}>
            {STATUS_LABELS[status] ?? status}
        </Badge>
    );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
    return (
        <div className={`flex flex-col ml-1 ${active ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'} transition-opacity`}>
            <ChevronUp className={`w-[10px] h-[10px] -mb-[4px] ${active && direction === 'asc' ? 'text-accent' : 'text-text-muted'}`} />
            <ChevronDown className={`w-[10px] h-[10px] ${active && direction === 'desc' ? 'text-accent' : 'text-text-muted'}`} />
        </div>
    );
}

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

    // Close dropdown on outside click
    useEffect(() => {
        if (!activeDropdown) return;
        const handleClickOutside = () => setActiveDropdown(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [activeDropdown]);

    // confirmDelete holds the bookingId pending permanent deletion
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // confirmCancel holds the bookingId pending cancellation
    const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
    const [reassignTarget, setReassignTarget] = useState<string | null>(null);
    const [selectedFlagsBooking, setSelectedFlagsBooking] = useState<any | null>(null);

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
                toast(`Updated ${ids.length} bookings to "${STATUS_LABELS[status] || status}".`, 'success');
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
                toast(`Status updated to "${STATUS_LABELS[status] ?? status}".`, 'success');
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
        let notes: ChildNote[] = [];
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
        let notes: ChildNote[] = [];
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
                <EmptyState
                    icon={<SearchX className="w-8 h-8" />}
                    title="No results found"
                    description="We couldn't find any bookings matching your current filters. Try adjusting your search term, centre, or status."
                    action={
                        <Button variant="secondary" onClick={() => router.push('/dashboard/bookings')}>
                            Clear All Filters
                        </Button>
                    }
                />
            );
        }

        return (
            <EmptyState
                icon={<CalendarIcon className="w-8 h-8" />}
                title="No bookings found"
                description="Upcoming or past bookings will appear here once they are created. Try adjusting your filters or create a new session booking."
                action={
                    <Button asChild>
                        <Link href="/dashboard/bookings/new">+ Book Session</Link>
                    </Button>
                }
            />
        );
    }

    return (
        <>
            {/* Cancel Confirmation Modal */}
            {confirmCancel && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cancel-dialog-title"
                >
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-md bg-warning-soft flex items-center justify-center mx-auto mb-4">
                            <X className="w-6 h-6 text-amber-700 dark:text-amber-400" />
                        </div>
                        <h3 id="cancel-dialog-title" className="text-section-title text-text text-center mb-2">Cancel Booking?</h3>
                        <p className="text-small-body text-text-secondary text-center mb-6">
                            The booking will be marked as <strong className="text-text">cancelled</strong>. The record is kept for your records but no longer shown as confirmed.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" disabled={isCancelling} onClick={() => setConfirmCancel(null)}>
                                Keep Booking
                            </Button>
                            <Button className="flex-1" disabled={isCancelling} onClick={handleCancelConfirm}>
                                {isCancelling ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</> : 'Yes, Cancel'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-dialog-title"
                >
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-md bg-danger-soft flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-danger" />
                        </div>
                        <h3 id="delete-dialog-title" className="text-section-title text-text text-center mb-2">Delete Booking?</h3>
                        <p className="text-small-body text-text-secondary text-center mb-6">
                            This will permanently remove the booking record. This action <strong className="text-text">cannot be undone</strong>.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" disabled={isDeleting} onClick={() => setConfirmDelete(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDelete}>
                                {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Yes, Delete'}
                            </Button>
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
                    onSuccess={() => {
                        router.refresh();
                    }}
                />
            )}

            <div className="bg-surface border border-border rounded-lg overflow-hidden relative">
                {/* Table for Desktop */}
                <div className="hidden lg:block overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <input
                                        type="checkbox"
                                        checked={bookings.length > 0 && selectedBookings.size === bookings.length}
                                        onChange={handleSelectAll}
                                        aria-label="Select all bookings"
                                        className="w-4 h-4 rounded-sm border border-border accent-accent cursor-pointer"
                                    />
                                </TableHead>
                                <TableHead>
                                    <button className="flex items-center gap-1 group" onClick={() => handleSort('date')}>
                                        Date &amp; Time
                                        <SortIcon active={sortConfig.key === 'date'} direction={sortConfig.direction} />
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button className="flex items-center gap-1 group" onClick={() => handleSort('student')}>
                                        Student(s)
                                        <SortIcon active={sortConfig.key === 'student'} direction={sortConfig.direction} />
                                    </button>
                                </TableHead>
                                <TableHead>Flags</TableHead>
                                <TableHead>Session Type</TableHead>
                                <TableHead>Centre</TableHead>
                                <TableHead>
                                    <button className="flex items-center gap-1 group" onClick={() => handleSort('status')}>
                                        Status
                                        <SortIcon active={sortConfig.key === 'status'} direction={sortConfig.direction} />
                                    </button>
                                </TableHead>
                                <TableHead align="right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedBookings.map((booking) => (
                                <TableRow
                                    key={booking.id}
                                    clickable
                                    onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                                    className={`group ${selectedBookings.has(booking.id) ? 'bg-accent-soft' : ''}`}
                                >
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedBookings.has(booking.id)}
                                            onChange={() => handleSelectRow(booking.id)}
                                            aria-label="Select booking"
                                            className="w-4 h-4 rounded-sm border border-border accent-accent cursor-pointer"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-text whitespace-nowrap">
                                                {booking.startAt ? format(new Date(booking.startAt), 'EEE, MMM d') : 'N/A'}
                                            </span>
                                            <span className="text-metadata mt-0.5 whitespace-nowrap">
                                                {booking.startAt ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center text-accent text-xs font-semibold flex-shrink-0">
                                                {getStudentInitials(booking)}
                                            </div>
                                            {(() => {
                                                const { first, rest, firstId } = getStudentList(booking);
                                                const targetId = firstId || booking.attendees?.[0]?.child?.id || booking.child?.id;
                                                return (
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <Link
                                                            href={`/dashboard/students/${targetId}`}
                                                            className="font-medium text-text group-hover:text-accent transition-colors hover:underline truncate"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {first}
                                                        </Link>
                                                        {rest.length > 0 && (
                                                            <div className="relative group/more flex-shrink-0">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-page text-text-muted text-[10px] font-semibold cursor-default border border-border">
                                                                    +{rest.length}
                                                                </span>
                                                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/more:block min-w-[160px] max-w-[220px] p-3 bg-surface-elevated border border-border rounded-md shadow-[var(--shadow-popover)] z-[60]">
                                                                    <p className="text-label text-text-muted mb-2">All Students</p>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-sm font-medium text-text">{first}</span>
                                                                        {rest.map((name, i) => (
                                                                            <span key={i} className="text-sm font-medium text-text">{name}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            {hasMedicalNote(booking) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedFlagsBooking(booking); }}
                                                    className="flex items-center justify-center w-6 h-6 rounded-full bg-danger-soft hover:opacity-80 transition-opacity"
                                                    title="Medical / allergy alert"
                                                >
                                                    <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                                                </button>
                                            )}
                                            {hasSafeguardingNote(booking) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedFlagsBooking(booking); }}
                                                    className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-soft hover:opacity-80 transition-opacity"
                                                    title="Safeguarding alert"
                                                >
                                                    <Shield className="w-3.5 h-3.5 text-accent" />
                                                </button>
                                            )}
                                            {!hasMedicalNote(booking) && !hasSafeguardingNote(booking) && (
                                                <span className="text-text-muted">–</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge>
                                            {booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : booking.assessmentType === 'progress_review' ? 'Progress Check' : 'Activity'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-text-secondary">
                                            <MapPin className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                                            <span className="truncate">{booking.centre?.name || 'Unknown'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={booking.status} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            {(booking.parent?.email || booking.parent?.phone) && (
                                                <div className="flex items-center gap-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    {booking.parent.email && (
                                                        <a
                                                            href={`mailto:${booking.parent.email}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1.5 hover:bg-page rounded-sm text-text-muted hover:text-text transition-colors"
                                                            title={`Email ${booking.parent.firstName}`}
                                                        >
                                                            <Mail className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                    {booking.parent.phone && (
                                                        <a
                                                            href={`tel:${booking.parent.phone}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1.5 hover:bg-page rounded-sm text-text-muted hover:text-text transition-colors"
                                                            title={`Call ${booking.parent.firstName}`}
                                                        >
                                                            <Phone className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            <div className="relative inline-block">
                                                <button
                                                    suppressHydrationWarning
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdown(activeDropdown === booking.id ? null : booking.id);
                                                    }}
                                                    className="p-2 hover:bg-page rounded-sm transition-colors"
                                                    aria-label="Booking actions"
                                                >
                                                    <MoreVertical className="w-4 h-4 text-text-muted" />
                                                </button>

                                                {activeDropdown === booking.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-52 bg-surface-elevated rounded-md shadow-[var(--shadow-popover)] border border-border py-1.5 z-20">
                                                        <Link
                                                            href={`/dashboard/bookings/${booking.id}`}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                            View Details
                                                        </Link>
                                                        {(booking.attendees?.[0]?.child?.id || booking.child?.id) && (
                                                            <Link
                                                                href={`/dashboard/students/${booking.attendees?.[0]?.child?.id || booking.child?.id}`}
                                                                className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-accent transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                </svg>
                                                                View Student Profile
                                                            </Link>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleReschedule(booking.id); }}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left"
                                                        >
                                                            <CalendarIcon className="w-4 h-4" />
                                                            Reschedule
                                                        </button>
                                                        {centres.length > 1 && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setReassignTarget(booking.id); setActiveDropdown(null); }}
                                                                className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left"
                                                            >
                                                                <MapPin className="w-4 h-4 text-accent" />
                                                                Reassign Centre
                                                            </button>
                                                        )}
                                                        <div className="mx-3 my-1 border-t border-border-subtle" />
                                                        <p className="px-4 py-1 text-label text-text-muted">Quick Status</p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'confirmed'); }}
                                                            disabled={updatingStatus === booking.id}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left disabled:opacity-50"
                                                        >
                                                            <BookOpen className="w-4 h-4" />
                                                            Mark as Booked
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'signed_up'); }}
                                                            disabled={updatingStatus === booking.id}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left disabled:opacity-50"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                            Mark as Signed-up
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'completed'); }}
                                                            disabled={updatingStatus === booking.id}
                                                            title="Marks entire booking as attended (applies to all children)"
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left disabled:opacity-50"
                                                        >
                                                            <GraduationCap className="w-4 h-4" />
                                                            Mark as Attended
                                                        </button>
                                                        <div className="mx-3 my-1 border-t border-border-subtle" />
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openCancelModal(booking.id); }}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-danger-soft text-sm text-danger transition-colors w-full text-left"
                                                        >
                                                            <X className="w-4 h-4" />
                                                            Cancel Booking
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(booking.id); setActiveDropdown(null); }}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-danger-soft text-sm text-danger transition-colors w-full text-left"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Delete Booking
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Card View for Mobile */}
                <div className="lg:hidden divide-y divide-border-subtle">
                    <div className="p-4 bg-page flex items-center justify-between border-b border-border">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={bookings.length > 0 && selectedBookings.size === bookings.length}
                                onChange={handleSelectAll}
                                aria-label="Select all bookings"
                                className="w-4 h-4 rounded-sm border border-border accent-accent cursor-pointer"
                            />
                            <span className="text-sm font-medium text-text">Select All</span>
                        </div>
                    </div>
                    {sortedBookings.map((booking) => (
                        <div
                            key={booking.id}
                            onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                            className={`p-4 cursor-pointer hover:bg-page/60 transition-colors ${selectedBookings.has(booking.id) ? 'bg-accent-soft' : ''}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div onClick={(e) => e.stopPropagation()} className="pt-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedBookings.has(booking.id)}
                                            onChange={() => handleSelectRow(booking.id)}
                                            aria-label="Select booking"
                                            className="w-4 h-4 rounded-sm border border-border accent-accent cursor-pointer"
                                        />
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center text-accent text-xs font-semibold">
                                        {getStudentInitials(booking)}
                                    </div>
                                    <div>
                                        <Link
                                            href={`/dashboard/students/${booking.attendees?.[0]?.child?.id || booking.child?.id}`}
                                            className="text-sm font-medium text-text hover:text-accent hover:underline transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {getStudentNames(booking)}
                                        </Link>
                                        <p className="text-metadata mt-0.5">{booking.centre?.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={booking.status} />
                                    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            suppressHydrationWarning
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveDropdown(activeDropdown === `mobile-${booking.id}` ? null : `mobile-${booking.id}`);
                                            }}
                                            className="p-1.5 hover:bg-page rounded-sm transition-colors -mr-1"
                                            aria-label="Booking actions"
                                        >
                                            <MoreVertical className="w-4 h-4 text-text-muted" />
                                        </button>

                                        {activeDropdown === `mobile-${booking.id}` && (
                                            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-elevated rounded-md shadow-[var(--shadow-popover)] border border-border py-1.5 z-20">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleReschedule(booking.id); }}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left"
                                                >
                                                    <CalendarIcon className="w-4 h-4" />
                                                    Reschedule
                                                </button>
                                                {centres.length > 1 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReassignTarget(booking.id); setActiveDropdown(null); }}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left"
                                                    >
                                                        <MapPin className="w-4 h-4 text-accent" />
                                                        Reassign Centre
                                                    </button>
                                                )}
                                                <div className="mx-3 my-1 border-t border-border-subtle" />
                                                <p className="px-4 py-1 text-label text-text-muted">Quick Status</p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'confirmed'); }}
                                                    disabled={updatingStatus === booking.id}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left disabled:opacity-50"
                                                >
                                                    <BookOpen className="w-4 h-4" />
                                                    Mark as Booked
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'signed_up'); }}
                                                    disabled={updatingStatus === booking.id}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left disabled:opacity-50"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Mark as Signed-up
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatus(booking.id, 'completed'); }}
                                                    disabled={updatingStatus === booking.id}
                                                    title="Marks entire booking as attended (applies to all children)"
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-page text-sm text-text transition-colors w-full text-left disabled:opacity-50"
                                                >
                                                    <GraduationCap className="w-4 h-4" />
                                                    Mark as Attended
                                                </button>
                                                <div className="mx-3 my-1 border-t border-border-subtle" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openCancelModal(booking.id); }}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-danger-soft text-sm text-danger transition-colors w-full text-left"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Cancel Booking
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(booking.id); setActiveDropdown(null); }}
                                                    className="flex items-center gap-3 px-4 py-2 hover:bg-danger-soft text-sm text-danger transition-colors w-full text-left"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete Booking
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3 pl-8">
                                <div className="flex flex-col gap-1.5 text-metadata">
                                    <span className="font-medium text-text-secondary">{booking.assessmentType === 'initial_assessment' ? 'Initial Assessment' : booking.assessmentType === 'progress_review' ? 'Progress Check' : 'Activity'}</span>
                                    <div className="flex items-center gap-1.5">
                                        <CalendarIcon className="w-3.5 h-3.5 text-text-muted" />
                                        {booking.startAt ? format(new Date(booking.startAt), 'MMM d, yyyy') : 'Date TBD'}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-text-muted" />
                                        {booking.startAt ? format(new Date(booking.startAt), 'h:mm a') : 'Time TBD'}
                                    </div>
                                </div>
                            </div>

                            {(hasMedicalNote(booking) || hasSafeguardingNote(booking)) && (
                                <div className="flex items-center gap-2 mb-3 pl-8">
                                    {hasMedicalNote(booking) && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedFlagsBooking(booking); }}
                                            className="flex items-center justify-center w-6 h-6 rounded-full bg-danger-soft"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                                        </button>
                                    )}
                                    {hasSafeguardingNote(booking) && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedFlagsBooking(booking); }}
                                            className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-soft"
                                        >
                                            <Shield className="w-3.5 h-3.5 text-accent" />
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="flex mt-3 pl-8">
                                <Button variant="secondary" size="sm" className="w-full" asChild>
                                    <Link href={`/dashboard/bookings/${booking.id}`}>
                                        <Eye className="w-4 h-4" />
                                        View Details
                                    </Link>
                                </Button>
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
                <div className="bg-surface-elevated border border-border shadow-[var(--shadow-popover)] rounded-md p-2 px-3 flex items-center gap-4 mx-4 w-full max-w-2xl justify-between">
                    <div className="flex items-center gap-2">
                        <div className="pl-2 pr-4 py-2 border-r border-border-subtle flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center font-semibold text-xs">
                                {selectedBookings.size}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBulkStatus('completed')}
                                disabled={isProcessingBulk}
                                title="Marks selected bookings as attended (applies to all children in each booking)"
                            >
                                {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                                <span className="hidden sm:inline">Mark as</span> Attended
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBulkStatus('signed_up')}
                                disabled={isProcessingBulk}
                            >
                                {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                <span className="hidden sm:inline">Mark</span> Signed-up
                            </Button>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmBulkDelete(true)}
                        disabled={isProcessingBulk}
                        className="text-danger hover:bg-danger-soft"
                    >
                        {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                    </Button>
                </div>
            </div>

            {/* Bulk Delete Confirmation Modal */}
            {confirmBulkDelete && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="bulk-delete-dialog-title"
                >
                    <div className="bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-md bg-danger-soft flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-danger" />
                        </div>
                        <h3 id="bulk-delete-dialog-title" className="text-section-title text-text text-center mb-2">
                            Delete {selectedBookings.size} Booking{selectedBookings.size !== 1 ? 's' : ''}?
                        </h3>
                        <p className="text-small-body text-text-secondary text-center mb-6">
                            This will permanently remove <strong className="text-text">{selectedBookings.size} booking{selectedBookings.size !== 1 ? 's' : ''}</strong>. This action <strong className="text-text">cannot be undone</strong>.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setConfirmBulkDelete(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={handleBulkDelete}>
                                <Trash2 className="w-4 h-4" /> Delete All
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Side Panel for Flags */}
            {selectedFlagsBooking && (
                <div className="fixed inset-0 z-[300] flex justify-end bg-black/40" onClick={() => setSelectedFlagsBooking(null)}>
                    <div
                        className="w-full max-w-sm h-full bg-surface border-l border-border shadow-[var(--shadow-popover)] p-6 flex flex-col animate-in slide-in-from-right duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                            <h2 className="text-section-title text-text">Important Notes</h2>
                            <button onClick={() => setSelectedFlagsBooking(null)} className="p-2 hover:bg-page rounded-full transition-colors">
                                <X className="w-5 h-5 text-text-muted" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                            {hasMedicalNote(selectedFlagsBooking) && (
                                <div className="p-4 bg-danger-soft rounded-md">
                                    <div className="flex items-center gap-2 text-danger font-semibold mb-2">
                                        <AlertTriangle className="w-4 h-4" /> Medical / Allergy Alert
                                    </div>
                                    <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                                        {getMedicalNotesContent(selectedFlagsBooking)}
                                    </div>
                                </div>
                            )}
                            {hasSafeguardingNote(selectedFlagsBooking) && (
                                <div className="p-4 bg-accent-soft rounded-md">
                                    <div className="flex items-center gap-2 text-accent font-semibold mb-2">
                                        <Shield className="w-4 h-4" /> Safeguarding Alert
                                    </div>
                                    <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                                        {getSafeguardingNotesContent(selectedFlagsBooking)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
