'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface RescheduleFormProps {
    bookingId: string;
    currentDate: string;
    currentTime: string;
    operatingHours?: string | null;
}

function formatAmPm(time: string) {
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'pm' : 'am';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${ampm}`;
}

export default function RescheduleForm({ bookingId, currentDate, currentTime, operatingHours }: RescheduleFormProps) {
    const router = useRouter();
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [daySchedule, setDaySchedule] = useState<{ start: string; end: string; open: boolean } | null>(null);

    // Calculate day schedule when date changes
    useEffect(() => {
        if (!newDate) {
            setDaySchedule(null);
            return;
        }
        try {
            const parsedHours = operatingHours ? JSON.parse(operatingHours) : {
                monday: { open: true, start: '09:00', end: '17:00' },
                tuesday: { open: true, start: '09:00', end: '17:00' },
                wednesday: { open: true, start: '09:00', end: '17:00' },
                thursday: { open: true, start: '09:00', end: '17:00' },
                friday: { open: true, start: '09:00', end: '17:00' },
                saturday: { open: false, start: '09:00', end: '13:00' },
                sunday: { open: false, start: '09:00', end: '13:00' }
            };
            const dateObj = new Date(newDate);
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayOfWeek = days[dateObj.getDay()];
            setDaySchedule(parsedHours[dayOfWeek] || null);
        } catch (e) {
            logger.error('Failed to parse operating hours', e);
            setDaySchedule(null);
        }
    }, [newDate, operatingHours]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (daySchedule && daySchedule.open) {
            if (newTime < daySchedule.start || newTime > daySchedule.end) {
                setError(`Time must be between ${formatAmPm(daySchedule.start)} and ${formatAmPm(daySchedule.end)}`);
                return;
            }
        } else if (daySchedule && !daySchedule.open) {
            setError('The centre is closed on this day.');
            return;
        }

        setLoading(true);

        try {
            // Combine date and time into ISO string
            const newDateTime = new Date(`${newDate}T${newTime}`).toISOString();

            const response = await fetch(`/api/bookings/${bookingId}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newStartAt: newDateTime }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reschedule booking');
            }

            setSuccess(true);
            setTimeout(() => {
                router.push(`/dashboard/bookings/${bookingId}`);
                router.refresh();
            }, 1500);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    // Get minimum date (today)
    const today = new Date().toISOString().split('T')[0];

    return (
        <Card className="p-6">
            <h3 className="text-section-title text-text mb-6">Select New Date &amp; Time</h3>

            {success ? (
                <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
                    <div className="flex size-14 items-center justify-center rounded-full bg-success-soft mx-auto mb-4">
                        <Check className="w-7 h-7 text-success" />
                    </div>
                    <h4 className="text-section-title text-text mb-2">Booking Rescheduled!</h4>
                    <p className="text-text-secondary text-small-body">Redirecting to booking details...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Date Input */}
                    <div>
                        <label className="block text-label text-text-muted mb-2">
                            New Date
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                                type="date"
                                value={newDate}
                                onChange={(e) => {
                                    setNewDate(e.target.value);
                                    setNewTime(''); // Reset time when date changes
                                }}
                                min={today}
                                required
                                className="w-full h-9 pl-9 pr-3 rounded-sm border border-border bg-surface text-text text-small-body focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                            />
                        </div>
                    </div>

                    {/* Time Input */}
                    <div>
                        <label className="block text-label text-text-muted mb-2">
                            New Time
                        </label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                                type="time"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                min={daySchedule?.start || '00:00'}
                                max={daySchedule?.end || '23:59'}
                                required
                                className="w-full h-9 pl-9 pr-3 rounded-sm border border-border bg-surface text-text text-small-body focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                            />
                        </div>
                        {daySchedule && daySchedule.open && (
                            <p className="mt-2 text-small-body text-text-secondary">
                                Centre hours: <span className="text-text font-medium">{formatAmPm(daySchedule.start)} - {formatAmPm(daySchedule.end)}</span>
                            </p>
                        )}
                        {daySchedule && !daySchedule.open && (
                            <p className="mt-2 text-small-body text-danger">
                                Centre is closed on this day.
                            </p>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-danger-soft border border-danger/20 text-danger px-4 py-3 rounded-md text-small-body font-medium">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={loading || !newDate || !newTime || (daySchedule ? !daySchedule.open : false)}
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Rescheduling...
                            </>
                        ) : (
                            'Reschedule Booking'
                        )}
                    </Button>
                </form>
            )}
        </Card>
    );
}
