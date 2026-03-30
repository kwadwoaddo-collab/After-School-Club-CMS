'use client';

import { useState } from 'react';
import { Calendar, Clock, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RescheduleFormProps {
    bookingId: string;
    currentDate: string;
    currentTime: string;
}

export default function RescheduleForm({ bookingId, currentDate, currentTime }: RescheduleFormProps) {
    const router = useRouter();
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
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
        <div className="glass-card rounded-[32px] p-8 !bg-[#1a1c23]/80 !border-[#2a2d35]">
            <h3 className="text-lg font-bold text-white mb-6">Select New Date & Time</h3>

            {success ? (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Booking Rescheduled!</h4>
                    <p className="text-slate-600">Redirecting to booking details...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Date Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-200 mb-2">
                            New Date
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                min={today}
                                required
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* Time Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-200 mb-2">
                            New Time
                        </label>
                        <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="time"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                required
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !newDate || !newTime}
                        className="w-full py-4 bg-primary hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-2xl text-white font-bold transition-all shadow-lg shadow-primary/30 disabled:shadow-none flex items-center justify-center gap-2"
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
