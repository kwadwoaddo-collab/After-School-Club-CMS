'use client';

import { useState } from 'react';

interface MarkAttendedButtonProps {
    bookingId: string;
    /** Current booking status from the DB */
    initialStatus: string;
}

/**
 * Client component that sends a PATCH request to mark a booking as completed
 * (displayed as "Attended" in the UI). Gives immediate optimistic feedback.
 */
export default function MarkAttendedButton({ bookingId, initialStatus }: MarkAttendedButtonProps) {
    const [status, setStatus] = useState(initialStatus);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Already marked — show inert badge
    if (status === 'completed') {
        return (
            <span className="px-6 py-3 bg-violet-100 text-violet-700 rounded-2xl text-sm font-bold ring-1 ring-violet-600/20 select-none">
                ✓ Attended
            </span>
        );
    }

    const handleClick = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to update booking');
            }

            // Optimistic update — immediately show "Attended"
            setStatus('completed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handleClick}
                disabled={loading}
                className="px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving…
                    </>
                ) : (
                    'Mark as Attended'
                )}
            </button>
            {error && (
                <p className="text-xs text-red-600 font-medium">{error}</p>
            )}
        </div>
    );
}
