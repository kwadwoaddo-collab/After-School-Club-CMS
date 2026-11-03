'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface MarkAttendedButtonProps {
    bookingId: string;
    /** Current booking status from the DB */
    initialStatus: string;
}

/**
 * Client component that sends a PATCH request to mark a booking as completed ("Attended")
 * or "did_not_attend" ("Did Not Attend"). Refreshes the server page immediately on success.
 */
export default function MarkAttendedButton({ bookingId, initialStatus }: MarkAttendedButtonProps) {
    const [status, setStatus] = useState(initialStatus);
    const [loadingTarget, setLoadingTarget] = useState<'completed' | 'did_not_attend' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);

    const updateStatus = async (targetStatus: 'completed' | 'did_not_attend') => {
        setLoadingTarget(targetStatus);
        setError(null);
        try {
            const res = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to update booking');
            }

            setStatus(targetStatus);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoadingTarget(null);
        }
    };

    if (status === 'cancelled') {
        return null;
    }

    if (status === 'completed') {
        return (
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="success" className="select-none">
                        <Check className="w-3 h-3" /> Attended
                    </Badge>
                    <button
                        type="button"
                        disabled={loadingTarget !== null}
                        onClick={() => updateStatus('did_not_attend')}
                        className="text-xs font-medium text-text-muted hover:text-amber-600 dark:hover:text-amber-400 underline-offset-2 hover:underline transition-colors disabled:opacity-50"
                    >
                        {loadingTarget === 'did_not_attend' ? 'Updating…' : 'Mark Did Not Attend'}
                    </button>
                </div>
                {error && (
                    <p className="text-xs text-danger font-medium">{error}</p>
                )}
            </div>
        );
    }

    if (status === 'did_not_attend') {
        return (
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="warning" className="select-none">
                        <XCircle className="w-3 h-3" /> Did Not Attend
                    </Badge>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loadingTarget !== null}
                        onClick={() => updateStatus('completed')}
                    >
                        {loadingTarget === 'completed' ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <Check className="w-3.5 h-3.5" />
                                Mark as Attended
                            </>
                        )}
                    </Button>
                </div>
                {error && (
                    <p className="text-xs text-danger font-medium">{error}</p>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 flex-wrap">
                <Button
                    type="button"
                    onClick={() => updateStatus('completed')}
                    disabled={loadingTarget !== null}
                >
                    {loadingTarget === 'completed' ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            Mark as Attended
                        </>
                    )}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => updateStatus('did_not_attend')}
                    disabled={loadingTarget !== null}
                    className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                >
                    {loadingTarget === 'did_not_attend' ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <XCircle className="w-4 h-4" />
                            Did Not Attend
                        </>
                    )}
                </Button>
            </div>
            {error && (
                <p className="text-xs text-danger font-medium">{error}</p>
            )}
        </div>
    );
}
