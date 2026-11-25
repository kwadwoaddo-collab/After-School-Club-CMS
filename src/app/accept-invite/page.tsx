'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { CheckCircle, XCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';

const skipLinkClass =
    'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-accent focus:text-on-accent focus:text-sm focus:font-semibold focus:shadow-lg';

function BrandLockup() {
    return (
        <Link
            href="/"
            className={`inline-flex items-center gap-2.5 min-h-[44px] text-text ${focusRing}`}
            aria-label="After-School Club CMS · by SprintScale IT"
        >
            <span className="w-9 h-9 rounded-lg bg-accent text-on-accent inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
            <span className="flex flex-col leading-tight text-left">
                <span className="font-bold text-sm text-text">After-School Club CMS</span>
                <span className="text-xs text-text-muted">by SprintScale IT</span>
            </span>
        </Link>
    );
}

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const isLoginMode = searchParams.get('mode') === 'login';

    const [step, setStep] = useState<'validating' | 'ready' | 'logging-in' | 'success' | 'error'>('validating');
    const [inviteData, setInviteData] = useState<{
        email: string;
        name?: string;
        role: string;
        requiresAuth?: boolean;
        requiresPassword?: boolean;
    } | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const validateToken = async () => {
            try {
                const response = await fetch(`/api/staff/validate-invite?token=${encodeURIComponent(token || '')}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || (isLoginMode ? 'Invalid or expired sign-in link' : 'Invalid or expired invitation'));
                }

                setInviteData(data);
                setStep('ready');
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                setStep('error');
            }
        };

        if (!token) {
            setError(isLoginMode ? 'Invalid sign-in link' : 'Invalid invitation link');
            setStep('error');
            return;
        }
        validateToken();
    }, [token, isLoginMode]);

    const handleEnter = async () => {
        if (!token) return;
        setStep('logging-in');

        try {
            if (inviteData?.requiresAuth) {
                const acceptRes = await fetch('/api/staff/accept-invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        password: password || undefined,
                    }),
                });
                const acceptBody = await acceptRes.json().catch(() => ({}));
                if (!acceptRes.ok) {
                    throw new Error(
                        acceptBody.error || 'Please sign in to your existing account first to accept this invitation.'
                    );
                }

                if (inviteData.requiresPassword && password) {
                    await signIn('credentials', {
                        email: inviteData.email,
                        password,
                        redirect: false,
                    });
                }
            } else {
                const result = await signIn('inviteToken', {
                    token,
                    redirect: false,
                });

                if (result?.error) {
                    throw new Error('Failed to log in. The link may have already been used or expired.');
                }
            }

            setStep('success');
            setTimeout(() => {
                router.push('/dashboard');
                router.refresh();
            }, 800);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStep('error');
        }
    };

    const roleLabel = (role: string) =>
        role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Staff Member';

    if (step === 'validating') {
        return (
            <>
                <a href="#main-content" className={skipLinkClass}>Skip to main content</a>
                <main id="main-content" tabIndex={-1} className="min-h-screen bg-page text-text flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center shadow-sm">
                        <div className="flex justify-center mb-6"><BrandLockup /></div>
                        <Loader2 className="w-10 h-10 text-accent motion-safe:animate-spin mx-auto mb-4" aria-hidden="true" />
                        <p className="text-text-secondary text-base" role="status">
                            {isLoginMode ? 'Verifying your sign-in link...' : 'Validating your invitation...'}
                        </p>
                    </div>
                </main>
            </>
        );
    }

    if (step === 'error') {
        return (
            <>
                <a href="#main-content" className={skipLinkClass}>Skip to main content</a>
                <main id="main-content" tabIndex={-1} className="min-h-screen bg-page text-text flex items-center justify-center p-4">
                    <div role="alert" className="max-w-md w-full bg-surface rounded-2xl p-8 border border-border text-center shadow-sm">
                        <div className="flex justify-center mb-6"><BrandLockup /></div>
                        <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-8 h-8 text-danger" aria-hidden="true" />
                        </div>
                        <h1 className="text-2xl font-bold text-text mb-2">
                            {isLoginMode ? 'Sign-In Link Expired or Invalid' : 'Invitation Invalid'}
                        </h1>
                        <p className="text-text-secondary mb-3">{error}</p>
                        <p className="text-text-muted text-sm mb-6">
                            {isLoginMode
                                ? 'Staff sign-in links are single-use and expire after 15 minutes. Request a fresh link below.'
                                : 'Returning staff can request a new 15-minute sign-in link below, or ask your administrator for a fresh invitation.'}
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link
                                href="/staff-login"
                                className={`inline-flex items-center justify-center min-h-[44px] px-6 py-3 bg-accent text-on-accent font-semibold rounded-xl hover:bg-accent-hover transition-colors ${focusRing}`}
                            >
                                Request a new staff sign-in link
                            </Link>
                            <Link
                                href="/"
                                className={`inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 bg-surface-elevated border border-border text-text-secondary hover:text-text font-medium rounded-xl transition-colors text-sm ${focusRing}`}
                            >
                                Go to Homepage
                            </Link>
                        </div>
                    </div>
                </main>
            </>
        );
    }

    if (step === 'success') {
        return (
            <>
                <a href="#main-content" className={skipLinkClass}>Skip to main content</a>
                <main id="main-content" tabIndex={-1} className="min-h-screen bg-page text-text flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-surface rounded-2xl p-8 border border-border text-center shadow-sm" role="status">
                        <div className="flex justify-center mb-6"><BrandLockup /></div>
                        <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-accent" aria-hidden="true" />
                        </div>
                        <h1 className="text-2xl font-bold text-text mb-2">
                            {isLoginMode ? 'Signed in!' : 'Welcome aboard!'}
                        </h1>
                        <p className="text-text-secondary mb-4">Taking you to your dashboard...</p>
                        <Loader2 className="w-7 h-7 text-accent motion-safe:animate-spin mx-auto" aria-hidden="true" />
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <a href="#main-content" className={skipLinkClass}>Skip to main content</a>
            <main id="main-content" tabIndex={-1} className="min-h-screen bg-page text-text flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-border text-center shadow-sm">
                        <div className="flex justify-center mb-6"><BrandLockup /></div>

                        <div className="w-16 h-16 bg-accent-soft text-accent rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Sparkles className="w-8 h-8" aria-hidden="true" />
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-bold text-text mb-2">
                            {isLoginMode ? 'Confirm Staff Sign-In' : "You're invited!"}
                        </h1>
                        <p className="text-text-secondary mb-6 text-sm sm:text-base">
                            {isLoginMode ? (
                                <>
                                    Continue to your workspace as{' '}
                                    <span className="font-semibold text-text">{roleLabel(inviteData?.role || '')}</span>{' '}
                                    <span className="text-text-muted">(expires in 15 minutes)</span>.
                                </>
                            ) : (
                                <>
                                    You&apos;ve been added to the team as a{' '}
                                    <span className="font-semibold text-text">{roleLabel(inviteData?.role || '')}</span>.
                                </>
                            )}
                        </p>

                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-elevated rounded-full text-text text-sm mb-6 border border-border">
                            <span className="w-2 h-2 bg-accent rounded-full" aria-hidden="true" />
                            <span>{inviteData?.email}</span>
                        </div>

                        {inviteData?.requiresAuth && (
                            <div className="mb-6 text-left">
                                <p className="text-text-secondary text-xs mb-2">
                                    This email already has an existing account. Confirm your current password (or ensure you are signed in) to accept this organisation invitation.
                                </p>
                                {inviteData.requiresPassword && (
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Current account password"
                                        aria-label="Current account password"
                                        className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-page border border-border text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm"
                                    />
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleEnter}
                            disabled={step === 'logging-in'}
                            className={`w-full min-h-[44px] py-3.5 px-6 bg-accent text-on-accent font-bold text-base rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 ${focusRing}`}
                        >
                            {step === 'logging-in' ? (
                                <>
                                    <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-hidden="true" />
                                    Signing you in...
                                </>
                            ) : (
                                <>
                                    {isLoginMode ? 'Confirm & Enter Dashboard' : 'Enter Dashboard'}
                                    <ArrowRight className="w-5 h-5" aria-hidden="true" />
                                </>
                            )}
                        </button>

                        <p className="text-text-muted text-xs mt-6 leading-relaxed">
                            {isLoginMode
                                ? 'This sign-in link is single-use and expires in 15 minutes. Need another link? Visit the '
                                : 'This link is single-use and expires in 7 days. For future logins, use the '}
                            <Link href="/staff-login" className={`text-accent font-medium underline underline-offset-2 hover:text-accent-hover ${focusRing}`}>
                                staff login page
                            </Link>
                            .
                        </p>
                    </div>

                    <p className="text-center text-text-muted text-xs mt-6">
                        After-School Club CMS · by SprintScale IT
                    </p>
                </div>
            </main>
        </>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={
            <main id="main-content" tabIndex={-1} className="min-h-screen bg-page text-text flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent motion-safe:animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading invitation</span>
            </main>
        }>
            <AcceptInviteContent />
        </Suspense>
    );
}
