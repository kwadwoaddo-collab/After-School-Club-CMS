'use client';

import { useState } from 'react';
import { cancelBookingByParent } from '@/app/portal/actions';
import { XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function CancelBookingButton({ bookingId, className }: { bookingId: string, className?: string }) {
    const [isCancelling, setIsCancelling] = useState(false);

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this booking? This cannot be undone.')) {
            return;
        }

        setIsCancelling(true);
        const res = await cancelBookingByParent(bookingId);
        setIsCancelling(false);

        if (res.success) {
            toast.success('Booking cancelled successfully');
        } else {
            toast.error(res.error || 'Failed to cancel booking');
        }
    };

    return (
        <button 
            onClick={handleCancel}
            disabled={isCancelling}
            className={`px-4 py-2 border border-error/20 text-error text-sm font-bold rounded-lg hover:bg-error/10 transition-colors flex items-center gap-1.5 disabled:opacity-50 ${className || ''}`}
        >
            <XCircle className="w-3.5 h-3.5" /> {isCancelling ? 'Cancelling...' : 'Cancel'}
        </button>
    );
}
