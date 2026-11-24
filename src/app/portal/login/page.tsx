'use client';
import { logger } from '@/lib/logger';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';

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
            logger.error('Portal login failed', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-[var(--if-surface-elevated)] border border-[var(--if-border-subtle)] rounded-[14px] shadow-xl overflow-hidden">
            <div className="p-6 sm:p-8 text-center">
                <div className="w-14 h-14 bg-[var(--if-accent-soft)] text-[var(--if-accent)] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4" aria-hidden="true">
                    👋
                </div>
                <p className="text-sm font-bold text-[var(--if-accent)] mb-3" data-testid="portal-brand">SprintScale</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--if-accent)] mb-1">For Parents &amp; Carers</p>
                <h1 className="text-2xl font-bold text-[var(--if-text)] mb-2">Parent Portal</h1>
                <p className="text-sm text-[var(--if-text-secondary)] mb-8">
                    Enter your registered email and we&apos;ll send a secure sign-in link.
                </p>

                {errorParam === 'ExpiredOrInvalid' && (
                    <div role="alert" className="bg-[var(--if-danger-soft)] text-[var(--if-danger)] border border-[var(--if-danger)] p-3 rounded-lg text-sm mb-6">
                        That link has expired or is invalid. Please try again.
                    </div>
                )}
                {errorParam === 'InvalidToken' && (
                    <div role="alert" className="bg-[var(--if-danger-soft)] text-[var(--if-danger)] border border-[var(--if-danger)] p-3 rounded-lg text-sm mb-6">
                        Invalid link. Please try again.
                    </div>
                )}

                {!isSent ? (
                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        <div>
                            {/* A11Y-2: label is programmatically associated with input via htmlFor/id */}
                            <label htmlFor="portal-login-email" className="block text-sm font-medium text-[var(--if-text)] mb-1.5">Email Address</label>
                            <input id="portal-login-email" type="email" className="w-full px-4 py-3 min-h-[44px] bg-[var(--if-surface)] text-foreground placeholder:text-[var(--if-text-muted)] border border-[var(--if-text-muted)] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--if-accent)] focus:border-[var(--if-accent)] transition-all"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="parent@example.com"
                                autoComplete="email"
                            />
                        </div>
                        {error && (
                            <div role="alert" className="bg-[var(--if-danger-soft)] border border-[var(--if-danger)] text-[var(--if-danger)] px-3 py-2.5 rounded-lg text-sm mb-4">
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full min-h-[44px] py-3 px-4 rounded-lg bg-[#0F5F5C] text-white font-semibold hover:bg-[#0C4A47] transition-colors disabled:opacity-50 cursor-pointer ${focusRing}`}
                        >
                            {isSubmitting ? 'Sending Link…' : 'Send Sign-In Link'}
                        </button>
                    </form>
                ) : (
                    <div className="bg-[var(--if-success-soft)] border border-[var(--if-success)]/30 p-6 rounded-xl animate-fadeIn">
                        <h2 className="text-lg font-semibold text-[var(--if-success)] mb-2">Check your email!</h2>
                        <p className="text-[var(--if-text-secondary)] text-sm mb-4">
                            We&apos;ve sent a secure login link to <strong>{email}</strong>.
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsSent(false)}
                            className={`min-h-[44px] px-3 text-[var(--if-accent)] font-medium hover:underline text-sm ${focusRing}`}
                        >
                            Try another email
                        </button>

                        {process.env.NODE_ENV !== 'production' && debugLink && (
                            <div className="mt-6 p-4 bg-[var(--if-surface)] rounded text-left overflow-hidden">
                                <p className="text-xs font-mono text-[var(--if-text-muted)] mb-1">DEV MODE LINK:</p>
                                <a href={debugLink} className="text-[var(--if-accent)] text-xs break-all hover:underline">{debugLink}</a>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="bg-[var(--if-surface)] px-8 py-4 border-t border-[var(--if-border-subtle)] flex items-center justify-between gap-4 text-xs text-[var(--if-text-muted)]">
                <Link href="/" className={`hover:text-[var(--if-text)] transition-colors ${focusRing}`}>
                    ← Back to Home
                </Link>
                <span>
                    Not a parent? <Link href="/staff-login" className={`text-[var(--if-accent)] font-medium hover:underline ${focusRing}`}>Staff Login</Link>
                </span>
            </div>
        </div>
    );
}

export default function PortalLoginPage() {
    return (
        <main className="min-h-screen bg-[var(--if-page)] text-[var(--if-text)] flex flex-col items-center justify-center p-4">
            <Suspense fallback={
                <div className="w-full max-w-md bg-[var(--if-surface-elevated)] border border-[var(--if-border-subtle)] rounded-[14px] shadow-xl p-8 text-center">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="rounded-2xl bg-[var(--if-surface)] h-14 w-14 mb-6"></div>
                        <div className="h-4 bg-[var(--if-surface)] rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-[var(--if-surface)] rounded w-1/2"></div>
                    </div>
                </div>
            }>
                <PortalLoginForm />
            </Suspense>
        </main>
    );
}
