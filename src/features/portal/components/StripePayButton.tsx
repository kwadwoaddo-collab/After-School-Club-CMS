'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

interface StripePayButtonProps {
    invoiceId: string;
    amountDue: number;
}

/**
 * StripePayButton — initiates a Stripe Hosted Checkout session for an invoice.
 * Redirects the parent to Stripe's secure payment page.
 * Only rendered when STRIPE_SECRET_KEY is configured (checked server-side).
 */
export default function StripePayButton({ invoiceId, amountDue }: StripePayButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePay = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/portal/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start payment');
            if (data.sessionUrl) {
                window.location.href = data.sessionUrl;
            }
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2">
            <button
                onClick={handlePay}
                disabled={loading || amountDue <= 0}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed glow-btn"
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <CreditCard className="w-4 h-4" />
                )}
                {loading ? 'Redirecting to payment…' : `Pay £${amountDue.toFixed(2)} Online`}
            </button>
            {error && (
                <p className="text-xs text-destructive text-center font-medium">{error}</p>
            )}
            <p className="text-[10px] text-center text-on-surface-variant">
                Secured by Stripe · No card details stored here
            </p>
        </div>
    );
}
