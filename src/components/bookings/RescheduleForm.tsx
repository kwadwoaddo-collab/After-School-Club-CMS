'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
            console.error('Failed to parse operating hours', e);
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
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Get minimum date (today)
    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="bg-card border border-outline-variant/10 rounded-[32px] p-8 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6">Select New Date & Time</h3>

            {success ? (
                <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Booking Rescheduled!</h4>
                    <p className="text-on-surface-variant">Redirecting to booking details...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Date Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">
                            New Date
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="date"
                                value={newDate}
                                onChange={(e) => {
                                    setNewDate(e.target.value);
                                    setNewTime(''); // Reset time when date changes
                                }}
                                min={today}
                                required
                                className="w-full pl-12 pr-4 py-3 bg-secondary border border-border rounded-2xl text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* Time Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">
                            New Time
                        </label>
                        <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="time"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                min={daySchedule?.start || '00:00'}
                                max={daySchedule?.end || '23:59'}
                                required
                                className="w-full pl-12 pr-4 py-3 bg-secondary border border-border rounded-2xl text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            />
                        </div>
                        {daySchedule && daySchedule.open && (
                            <p className="mt-2 text-sm text-slate-400 font-medium ml-1">
                                Centre hours: <span className="text-white font-semibold">{formatAmPm(daySchedule.start)} - {formatAmPm(daySchedule.end)}</span>
                            </p>
                        )}
                        {daySchedule && !daySchedule.open && (
                            <p className="mt-2 text-sm text-rose-400 font-medium ml-1">
                                Centre is closed on this day.
                            </p>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-2xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !newDate || !newTime || (daySchedule ? !daySchedule.open : false)}
                        className="w-full py-4 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:text-slate-500 disabled:cursor-not-allowed rounded-2xl text-white font-bold transition-all shadow-lg shadow-primary/30 disabled:shadow-none flex items-center justify-center gap-2 glow-btn disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Rescheduling...
                            </>
                        ) : (
                            'Reschedule Booking'
                        )}
                    </button>
                </form>
            )}
        </div>
    );
}
