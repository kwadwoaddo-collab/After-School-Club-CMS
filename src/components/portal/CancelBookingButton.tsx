'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { cancelBookingByParent } from '@/app/portal/actions';
import { XCircle } from 'lucide-react';

export function CancelBookingButton({ bookingId, className }: { bookingId: string, className?: string }) {
    const [isCancelling, setIsCancelling] = useState(false);
    const { toast } = useToast();

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this booking? This cannot be undone.')) {
            return;
        }

        setIsCancelling(true);
        const res = await cancelBookingByParent(bookingId);
        setIsCancelling(false);

        if (res.success) {
            toast({ title: 'Success', message: 'Booking cancelled successfully', variant: 'success' });
        } else {
            toast({ title: 'Error', message: res.error || 'Failed to cancel booking', variant: 'error' });
        }
    };

    return (
        <button 
            onClick={handleCancel}
            disabled={isCancelling}
            className={`px-4 py-2 border border-rose-500/20 text-rose-500 text-sm font-bold rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-50 ${className || ''}`}
        >
            <XCircle className="w-3.5 h-3.5" /> {isCancelling ? 'Cancelling...' : 'Cancel'}
        </button>
    );
}
