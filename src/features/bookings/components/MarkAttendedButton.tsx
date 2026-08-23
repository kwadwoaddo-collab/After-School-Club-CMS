'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
            <Badge variant="success" className="select-none">
                <Check className="w-3 h-3" /> Attended
            </Badge>
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
            <Button onClick={handleClick} disabled={loading}>
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                    </>
                ) : (
                    'Mark as Attended'
                )}
            </Button>
            {error && (
                <p className="text-xs text-danger font-medium">{error}</p>
            )}
        </div>
    );
}
