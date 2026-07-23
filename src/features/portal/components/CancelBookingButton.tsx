'use client';
import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { cancelBookingByParent } from '@/app/portal/actions';
import { useToast } from '@/components/ui/ToastProvider';

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelBookingByParent(bookingId);
      setShowConfirm(false);
      if (res.success) {
          toast({ title: 'Success', message: 'Booking cancelled successfully', variant: 'success' });
      } else {
          toast({ title: 'Error', message: res.error || 'Failed to cancel booking', variant: 'error' });
      }
    });
  };

  return (
    <div>
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="min-h-[44px] px-4 py-2 border border-destructive/20 text-destructive text-sm font-semibold rounded-xl hover:bg-destructive/5 transition-all"
        >
          Cancel Booking
        </button>
      ) : (
        <div className="mt-2 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-200">
          <p className="text-sm font-semibold text-foreground">Cancel this booking?</p>
          <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Yes, cancel
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="flex-1 py-2.5 bg-secondary border border-border rounded-xl text-sm font-bold text-foreground disabled:opacity-60"
            >
              Keep booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
