'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function PortalLoginForm() {
    const searchParams = useSearchParams();
    const errorParam = searchParams.get('error');

    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [debugLink, setDebugLink] = useState<string | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setDebugLink(null);
        setError('');

        try {
            const res = await fetch('/api/portal/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();

            if (data.success) {
                setIsSent(true);
                if (data.debugLink) setDebugLink(data.debugLink);
            } else {
                setError(data.error || 'Failed to send link. Please try again.');
            }
        } catch (err) {
            console.error(err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
                    👋
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Parent Portal</h1>
                <p className="text-muted-foreground mb-2">Access your bookings and children's progress.</p>
                <p className="text-sm text-muted-foreground mb-8">No password needed — we'll email you a secure one-tap login link.</p>

                {errorParam === 'ExpiredOrInvalid' && (
                    <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-lg text-sm mb-6">
                        ⚠️ That link has expired or is invalid. Please try again.
                    </div>
                )}
                {errorParam === 'InvalidToken' && (
                    <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-lg text-sm mb-6">
                        ⚠️ Invalid link. Please try again.
                    </div>
                )}

                {!isSent ? (
                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="parent@example.com"
                                className="w-full px-4 py-3 border border-border rounded-lg outline-none transition-all"
                            />
                        </div>
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2.5 rounded-lg text-sm mb-4">
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Sending Link…' : 'Send Magic Link'}
                        </button>
                    </form>
                ) : (
                    <div className="bg-success/10 p-6 rounded-xl animate-fadeIn">
                        <h3 className="text-lg font-semibold text-success mb-2">Check your email!</h3>
                        <p className="text-success/80 text-sm mb-4">
                            We've sent a secure login link to <strong>{email}</strong>.
                        </p>
                        <button
                            onClick={() => setIsSent(false)}
                            className="text-success font-medium hover:underline text-sm"
                        >
                            Try another email
                        </button>

                        {process.env.NODE_ENV !== 'production' && debugLink && (
                            <div className="mt-6 p-4 bg-secondary/60 rounded text-left overflow-hidden">
                                <p className="text-xs font-mono text-muted-foreground mb-1">DEV MODE LINK:</p>
                                <a href={debugLink} className="text-primary text-xs break-all hover:underline">{debugLink}</a>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="bg-secondary/40 px-8 py-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                    Not a parent? <Link href="/login" className="text-primary hover:underline">Staff Login</Link>
                </p>
            </div>
        </div>
    );
}

export default function PortalLoginPage() {
    return (
        <div className="min-h-screen bg-secondary/40 flex flex-col items-center justify-center p-4">
            <Suspense fallback={
                <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-8 text-center">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="rounded-full bg-secondary h-16 w-16 mb-6"></div>
                        <div className="h-4 bg-secondary rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-secondary rounded w-1/2"></div>
                    </div>
                </div>
            }>
                <PortalLoginForm />
            </Suspense>
        </div>
    );
}
