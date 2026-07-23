'use client';

import { useState } from 'react';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import type { AttendanceStatus } from '@/lib/attendance';
import { getAttendanceLabel, getAttendanceColorClass, resolveAttendanceStatus } from '@/lib/attendance';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/components/ui/utils';

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
            setError(err.message || 'Failed to save attendance');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-secondary rounded-2xl p-4 border border-slate-700/50 mt-4">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance Status</label>
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getAttendanceColorClass(selectedStatus),
                        selectedStatus === 'pending' ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'border-current/20'
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
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-medium focus:border-primary/50 outline-none transition-colors appearance-none cursor-pointer"
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
                            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 outline-none transition-colors min-h-[80px] resize-none"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center flex-1">
                        {error && (
                            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </span>
                        )}
                        {success && !error && (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                <Check className="w-4 h-4" />
                                Saved successfully
                            </span>
                        )}
                    </div>
                    
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                    >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Record
                    </button>
                </div>
            </div>
        </div>
    );
}
