'use client';

import { useState } from 'react';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import type { AttendanceStatus } from '@/lib/attendance';
import { getAttendanceLabel, getAttendanceColorClass, resolveAttendanceStatus } from '@/lib/attendance';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/Button';

interface AttendanceDropdownProps {
    bookingId: string;
    attendeeId: string;
    currentAttendanceStatus: AttendanceStatus | null;
    currentBookingStatus: string;
    currentNote: string | null;
}

export default function AttendanceDropdown({
    bookingId,
    attendeeId,
    currentAttendanceStatus,
    currentBookingStatus,
    currentNote
}: AttendanceDropdownProps) {
    const resolved = resolveAttendanceStatus(currentAttendanceStatus, currentBookingStatus);

    // We treat the current state as the local state initially
    const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | 'pending' | 'cancelled' | 'rescheduled'>(resolved.status);
    const [note, setNote] = useState(currentNote || '');

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Filter to only the core statuses for the dropdown
    const availableStatuses: Array<{ value: AttendanceStatus | null, label: string }> = [
        { value: null, label: 'Pending (Clear)' },
        { value: 'present', label: 'Present' },
        { value: 'absent', label: 'Absent' },
        { value: 'late', label: 'Late' },
        { value: 'no_show', label: 'No Show' },
        { value: 'excused', label: 'Excused' },
    ];

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const statusToSave = selectedStatus === 'pending' || selectedStatus === 'cancelled' || selectedStatus === 'rescheduled' ? null : selectedStatus;

            await markAttendeeAttendance({
                bookingId,
                attendeeId,
                status: statusToSave,
                note: note.trim() || undefined
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            const message = err instanceof Error ? err.message : undefined;
            setError(message || 'Failed to save attendance');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-page rounded-md p-4 border border-border-subtle mt-4">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <label className="text-label text-text-muted">Attendance Status</label>
                    <span className={cn(
                        'px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider',
                        getAttendanceColorClass(selectedStatus)
                    )}>
                        {selectedStatus === 'pending' ? 'Pending' : getAttendanceLabel(selectedStatus as AttendanceStatus)}
                    </span>
                </div>

                <select
                    value={selectedStatus === 'pending' || selectedStatus === 'cancelled' || selectedStatus === 'rescheduled' ? '' : selectedStatus}
                    onChange={(e) => {
                        const val = e.target.value as AttendanceStatus | '';
                        setSelectedStatus(val === '' ? 'pending' : val);
                        setSuccess(false);
                    }}
                    className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-text text-small-body focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                >
                    {availableStatuses.map(s => (
                        <option key={s.value || 'pending'} value={s.value || ''}>{s.label}</option>
                    ))}
                </select>

                {(selectedStatus !== 'pending' && selectedStatus !== 'cancelled' && selectedStatus !== 'rescheduled') && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add an optional note (e.g. reason for absence)"
                            className="w-full bg-surface border border-border rounded-sm px-3 py-2.5 text-small-body text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent min-h-[80px] resize-none"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center flex-1">
                        {error && (
                            <span className="flex items-center gap-1.5 text-xs text-danger font-medium">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </span>
                        )}
                        {success && !error && (
                            <span className="flex items-center gap-1.5 text-xs text-success font-medium">
                                <Check className="w-4 h-4" />
                                Saved successfully
                            </span>
                        )}
                    </div>

                    <Button onClick={handleSave} disabled={isSaving} size="sm" className="ml-auto">
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Record
                    </Button>
                </div>
            </div>
        </div>
    );
}
