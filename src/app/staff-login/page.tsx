'use client';

import { useState } from 'react';
import { Mail, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';

function BrandLockup() {
    return (
        <a
            href="https://sprintscaleit.co.uk"
            className={`inline-flex items-center gap-2.5 min-h-[44px] text-[var(--if-text)] ${focusRing}`}
            aria-label="After-School Club CMS · by SprintScale IT"
        >
            <span className="w-9 h-9 rounded-lg bg-[#0F5F5C] text-white inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
            <span className="flex flex-col leading-tight text-left">
                <span className="font-bold text-sm">After-School Club CMS</span>
                <span className="text-xs text-[var(--if-text-muted)]">by SprintScale IT</span>
            </span>
        </a>
    );
}

export default function StaffLoginPage() {
    const [email, setEmail] = useState('');
    const [step, setStep] = useState<'form' | 'loading' | 'sent' | 'error'>('form');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep('loading');
        setError('');

        try {
            const response = await fetch('/api/staff/request-magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send login link');
            }

            setStep('sent');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStep('error');
        }
    };

    if (step === 'sent') {
        return (
            <div className="min-h-screen bg-[var(--if-page)] text-[var(--if-text)] flex items-center justify-center p-4 overflow-x-hidden">
                <div className="max-w-md w-full bg-[var(--if-surface-elevated)] rounded-3xl p-6 sm:p-8 border border-[var(--if-border-subtle)] text-center">
                    <div className="flex justify-center mb-6"><BrandLockup /></div>
                    <div className="w-16 h-16 bg-[var(--if-accent-soft)] rounded-2xl flex items-center justify-center mx-auto mb-6 text-[var(--if-accent)]">
                        <CheckCircle className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Check your email</h1>
                    <p className="text-[var(--if-text-secondary)] mb-2" role="status">
                        We&apos;ve sent a login link to:
                    </p>
                    <p className="font-semibold mb-6 break-all">{email}</p>
                    <p className="text-[var(--if-text-muted)] text-sm">
                        Click the link in the email to sign in. It expires in 15 minutes.
                    </p>
                    <button
                        type="button"
                        onClick={() => { setStep('form'); setEmail(''); }}
                        className={`mt-6 min-h-[44px] px-4 text-[var(--if-accent)] hover:text-[var(--if-accent-hover)] text-sm underline transition-colors ${focusRing}`}
                    >
                        Use a different email
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--if-page)] text-[var(--if-text)] flex items-center justify-center p-4 overflow-x-hidden">
            <div className="max-w-md w-full">
                <div className="bg-[var(--if-surface-elevated)] rounded-3xl p-6 sm:p-8 border border-[var(--if-border-subtle)]">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-5"><BrandLockup /></div>
                        <h1 className="text-2xl font-bold">Staff Login</h1>
                        <p className="text-[var(--if-text-secondary)] text-sm mt-1">
                            Enter your email to receive a sign-in link
                        </p>
                    </div>

                    {step === 'error' && (
                        <div role="alert" className="p-4 bg-[var(--if-danger-soft)] border border-[var(--if-danger)] rounded-xl text-[var(--if-danger)] text-sm mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="staff-login-email" className="block text-sm font-medium text-[var(--if-text-secondary)] mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--if-text-muted)]" aria-hidden="true" />
                                <input
                                    id="staff-login-email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 min-h-[44px] bg-[var(--if-surface)] border border-[var(--if-text-muted)] rounded-xl text-[var(--if-text)] placeholder:text-[var(--if-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--if-accent)] focus:border-[var(--if-accent)]"
                                    placeholder="you@example.com"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={step === 'loading'}
                            className={`w-full min-h-[44px] py-3 px-6 bg-[#0F5F5C] text-white font-semibold rounded-xl hover:bg-[#0C4A47] focus-visible:bg-[#0C4A47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${focusRing}`}
                        >
                            {step === 'loading' ? (
                                <>
                                    <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-hidden="true" />
                                    Sending link...
                                </>
                            ) : (
                                <>
                                    Send Login Link
                                    <ArrowRight className="w-5 h-5" aria-hidden="true" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-[var(--if-text-muted)] text-xs mt-6">
                        Only pre-approved staff emails can log in.
                        <br />Contact your admin if you need access.
                    </p>
                </div>

                <div className="text-center mt-6 flex flex-col items-center">
                    <Link href="/login" className={`min-h-[44px] inline-flex items-center text-[var(--if-text-secondary)] hover:text-[var(--if-text)] text-sm transition-colors ${focusRing}`}>
                        Admin login →
                    </Link>
                    <a href="https://sprintscaleit.co.uk" className={`min-h-[44px] inline-flex items-center text-[var(--if-text-muted)] hover:text-[var(--if-text)] text-xs transition-colors ${focusRing}`}>
                        Return to sprintscaleit.co.uk
                    </a>
                </div>
            </div>
        </div>
    );
}
