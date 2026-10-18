'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';
const linkClass = `text-[var(--if-accent)] hover:text-[var(--if-accent-hover)] underline underline-offset-2 ${focusRing}`;

function BrandLockup() {
    return (
        <Link href="/" className={`inline-flex items-center gap-2.5 min-h-[44px] w-fit text-[var(--if-text)] ${focusRing}`} aria-label="After-School Club CMS · by SprintScale IT">
            <span className="w-9 h-9 rounded-lg bg-[var(--if-accent)] text-white inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
            <span className="flex flex-col leading-tight text-left">
                <span className="font-bold text-sm">After-School Club CMS</span>
                <span className="text-xs text-[var(--if-text-muted)]">by SprintScale IT</span>
            </span>
        </Link>
    );
}

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            // Always show success (prevents email enumeration)
            setSent(true);
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid md:grid-cols-2 bg-[var(--if-page)] text-[var(--if-text)] overflow-x-hidden">
            {/* Left Side */}
            <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden bg-[var(--if-surface)] border-r border-[var(--if-border-subtle)]">
                <Link href="/" className={`flex items-center gap-2 min-h-[44px] w-fit text-[var(--if-text-secondary)] hover:text-[var(--if-text)] transition-colors mb-8 ${focusRing}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Home
                </Link>

                <div className="flex-1 flex flex-col justify-center">
                    <BrandLockup />
                    <h1 className="text-4xl lg:text-5xl font-bold mt-10 mb-6">
                        Get back <br />
                        <span className="text-[var(--if-accent)]">into your account</span>
                    </h1>
                    <p className="text-lg mb-8 text-[var(--if-text-secondary)]">
                        If you signed up with Google, just click <strong className="text-[var(--if-text)]">&quot;Sign in with Google&quot;</strong> — no password needed.
                    </p>
                    <div className="p-5 rounded-2xl bg-[var(--if-accent-soft)] border border-[var(--if-border-subtle)]">
                        <p className="text-[var(--if-text)] text-sm leading-relaxed">
                            <strong>Most admins sign in with Google.</strong> If you registered with a Google account (Gmail, Workspace, etc.), just use the Google Sign-In button — no password recovery needed.
                        </p>
                    </div>
                </div>

                <p className="mt-8 pt-6 border-t border-[var(--if-border-subtle)] text-xs text-[var(--if-text-muted)]">
                    After-School Club CMS · by <a href="https://sprintscaleit.co.uk" className={`font-bold text-[var(--if-text-secondary)] hover:text-[var(--if-accent)] hover:underline ${focusRing}`}>SprintScale IT</a>
                </p>
            </div>

            {/* Right Side */}
            <div className="flex flex-col items-center justify-center p-5 sm:p-8 min-w-0">
                <div className="md:hidden w-full flex justify-between items-center mb-6">
                    <BrandLockup />
                    <Link href="/" className={`min-h-[44px] inline-flex items-center text-sm text-[var(--if-text-secondary)] hover:text-[var(--if-text)] ${focusRing}`}>Home</Link>
                </div>
                <div className="max-w-md w-full">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold mb-2">Forgot Password?</h2>
                        <p className="text-sm text-[var(--if-text-secondary)]">
                            No problem — choose how you signed in originally
                        </p>
                    </div>

                    <div className="bg-[var(--if-surface-elevated)] rounded-2xl p-6 sm:p-8 border border-[var(--if-border-subtle)] space-y-6">

                        {/* Google Sign-In Option */}
                        <div>
                            <p className="text-[var(--if-text-secondary)] text-sm text-center mb-3">Signed up with Google?</p>
                            <button
                                type="button"
                                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                                className={`w-full min-h-[44px] py-3 px-4 rounded-lg bg-[var(--if-surface)] text-[var(--if-text)] border border-[var(--if-text-muted)] font-semibold hover:bg-[var(--if-accent-soft)] transition-colors flex items-center justify-center gap-2 ${focusRing}`}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Sign in with Google
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-px bg-[var(--if-border-subtle)] flex-1" />
                            <span className="text-sm text-[var(--if-text-muted)] font-medium">OR</span>
                            <div className="h-px bg-[var(--if-border-subtle)] flex-1" />
                        </div>

                        {/* Magic Link Option */}
                        {sent ? (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-[var(--if-accent-soft)] text-[var(--if-accent)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Check your inbox</h3>
                                <p className="text-[var(--if-text-secondary)] text-sm mb-1" role="status">We&apos;ve sent a password reset link to:</p>
                                <p className="font-medium mb-4 break-all">{email}</p>
                                <p className="text-[var(--if-text-muted)] text-xs mb-6">The link expires in 1 hour. Check your spam folder if you don&apos;t see it.</p>
                                <button
                                    type="button"
                                    onClick={() => { setSent(false); setEmail(''); }}
                                    className={`${linkClass} min-h-[44px] px-3 text-sm`}
                                >
                                    Try a different email
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-[var(--if-text-secondary)] text-sm text-center mb-3">Used email &amp; password? Get a magic login link:</p>
                                <form onSubmit={handleSendMagicLink} className="space-y-4">
                                    <div>
                                        <label htmlFor="forgot-email" className="block text-sm font-medium text-[var(--if-text-secondary)] mb-1">Email Address</label>
                                        <input
                                            id="forgot-email"
                                            type="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full px-4 py-3 min-h-[44px] rounded-lg bg-[var(--if-surface)] border border-[var(--if-text-muted)] text-[var(--if-text)] placeholder:text-[var(--if-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--if-accent)] focus:border-[var(--if-accent)]"
                                            placeholder="you@yourcentre.com"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    {error && (
                                        <div role="alert" className="p-3 bg-[var(--if-danger-soft)] border border-[var(--if-danger)] rounded-lg text-[var(--if-danger)] text-sm">{error}</div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || !email.trim()}
                                        className={`w-full min-h-[44px] py-3 rounded-lg bg-[var(--if-accent)] text-white font-semibold hover:bg-[var(--if-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${focusRing}`}
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="w-4 h-4 motion-safe:animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Sending...
                                            </>
                                        ) : (
                                            'Send me a login link'
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    <p className="text-center text-[var(--if-text-secondary)] text-sm mt-6">
                        Remember your password?{' '}
                        <Link href="/login" className={linkClass}>
                            Back to login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
