'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';
const linkClass = `text-[var(--if-accent)] hover:text-[var(--if-accent-hover)] underline underline-offset-2 ${focusRing}`;
const inputBase =
    'w-full px-4 py-3 min-h-[44px] rounded-lg bg-[var(--if-surface)] border text-[var(--if-text)] placeholder:text-[var(--if-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--if-accent)]';

function BrandLockup() {
    return (
        <Link href="/" className={`inline-flex items-center gap-2.5 min-h-[44px] w-fit text-[var(--if-text)] ${focusRing}`} aria-label="After-School Club CMS · by SprintScale IT">
            <span className="w-9 h-9 rounded-lg bg-[#0F5F5C] text-white inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
            <span className="flex flex-col leading-tight text-left">
                <span className="font-bold text-sm">After-School Club CMS</span>
                <span className="text-xs text-[var(--if-text-muted)]">by SprintScale IT</span>
            </span>
        </Link>
    );
}

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Invalid reset link. Please request a new one.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setSuccess(true);
            // Redirect to login after 3 seconds
            setTimeout(() => router.push('/login'), 3000);
        } catch (err) {
            setError((err instanceof Error ? err.message : String(err)) || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const strengthChecks = [
        { label: 'At least 8 characters', pass: newPassword.length >= 8 },
        { label: 'Contains a number', pass: /\d/.test(newPassword) },
        { label: 'Contains a letter', pass: /[a-zA-Z]/.test(newPassword) },
    ];

    const mismatch = Boolean(confirmPassword) && newPassword !== confirmPassword;

    return (
        <>
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Set New Password</h1>
                <p className="text-sm text-[var(--if-text-secondary)]">
                    Choose a strong password for your account
                </p>
            </div>

            <div className="bg-[var(--if-surface-elevated)] rounded-2xl p-6 sm:p-8 border border-[var(--if-border-subtle)]">
                {success ? (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-[var(--if-accent-soft)] text-[var(--if-accent)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="font-semibold text-xl mb-2">Password Updated!</h2>
                        <p className="text-[var(--if-text-secondary)] text-sm mb-4" role="status">Your password has been successfully changed.</p>
                        <p className="text-[var(--if-text-muted)] text-xs">Redirecting you to login...</p>
                    </div>
                ) : !token ? (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-[var(--if-danger-soft)] text-[var(--if-danger)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="font-semibold text-lg mb-2">Invalid Reset Link</h2>
                        <p className="text-[var(--if-text-secondary)] text-sm mb-6">This link is invalid or has expired.</p>
                        <Link href="/forgot-password" className={`${linkClass} inline-flex items-center min-h-[44px] font-medium`}>
                            Request a new reset link →
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* New Password */}
                        <div>
                            <label htmlFor="new-password" className="block text-sm font-medium text-[var(--if-text-secondary)] mb-1">New Password</label>
                            <div className="relative">
                                <input
                                    id="new-password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className={`${inputBase} pr-14 border-[var(--if-text-muted)] focus:border-[var(--if-accent)]`}
                                    placeholder="Min 8 characters"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    className={`absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--if-text-muted)] hover:text-[var(--if-text)] ${focusRing}`}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {/* Password strength */}
                            {newPassword && (
                                <div className="mt-2 space-y-1">
                                    {strengthChecks.map((check) => (
                                        <div key={check.label} className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${check.pass ? 'bg-[var(--if-accent)]' : 'bg-[var(--if-border-subtle)] border border-[var(--if-text-muted)]'}`} />
                                            <span className={`text-xs ${check.pass ? 'text-[var(--if-accent)]' : 'text-[var(--if-text-muted)]'}`}>{check.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--if-text-secondary)] mb-1">Confirm Password</label>
                            <input
                                id="confirm-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`${inputBase} ${mismatch ? 'border-[var(--if-danger)]' : 'border-[var(--if-text-muted)] focus:border-[var(--if-accent)]'}`}
                                placeholder="Re-enter new password"
                                aria-invalid={mismatch}
                                required
                            />
                            {mismatch && (
                                <p className="text-[var(--if-danger)] text-xs mt-1">Passwords do not match</p>
                            )}
                        </div>

                        {error && (
                            <div role="alert" className="p-3 bg-[var(--if-danger-soft)] border border-[var(--if-danger)] rounded-lg text-[var(--if-danger)] text-sm">{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !newPassword || !confirmPassword}
                            className={`w-full min-h-[44px] py-3 rounded-lg bg-[#0F5F5C] text-white font-semibold hover:bg-[#0C4A47] focus-visible:bg-[#0C4A47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${focusRing}`}
                        >
                            {loading ? (
                                <>
                                    <svg className="w-4 h-4 motion-safe:animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Updating...
                                </>
                            ) : (
                                'Update Password'
                            )}
                        </button>
                    </form>
                )}
            </div>

            <p className="text-center text-sm mt-6">
                <Link href="/login" className={`${linkClass} inline-flex items-center min-h-[44px]`}>
                    ← Back to login
                </Link>
            </p>
        </>
    );
}

export default function ResetPasswordPage() {
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
                    <p className="text-4xl lg:text-5xl font-bold mt-10 mb-6" role="presentation">
                        Almost <br />
                        <span className="text-[var(--if-accent)]">back in</span>
                    </p>
                    <p className="text-lg text-[var(--if-text-secondary)]">
                        Create a strong new password to secure your account.
                    </p>
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
                    <Suspense fallback={<div className="text-[var(--if-text-secondary)] text-center">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
