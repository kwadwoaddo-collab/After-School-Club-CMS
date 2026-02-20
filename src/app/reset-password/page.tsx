'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const strengthChecks = [
        { label: 'At least 8 characters', pass: newPassword.length >= 8 },
        { label: 'Contains a number', pass: /\d/.test(newPassword) },
        { label: 'Contains a letter', pass: /[a-zA-Z]/.test(newPassword) },
    ];

    return (
        <>
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Set New Password</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Choose a strong password for your account
                </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
                {success ? (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-green-500/20 border border-green-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-white font-semibold text-xl mb-2">Password Updated!</h3>
                        <p className="text-white/60 text-sm mb-4">Your password has been successfully changed.</p>
                        <p className="text-white/40 text-xs">Redirecting you to login...</p>
                    </div>
                ) : !token ? (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-red-500/20 border border-red-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-2">Invalid Reset Link</h3>
                        <p className="text-white/60 text-sm mb-6">This link is invalid or has expired.</p>
                        <Link href="/forgot-password" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            Request a new reset link →
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 rounded-lg bg-white border border-blue-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Min 8 characters"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${check.pass ? 'bg-green-400' : 'bg-white/20'}`} />
                                            <span className={`text-xs ${check.pass ? 'text-green-400' : 'text-white/40'}`}>{check.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">Confirm Password</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full px-4 py-3 rounded-lg bg-white border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${confirmPassword && newPassword !== confirmPassword ? 'border-red-400' : 'border-blue-200'}`}
                                placeholder="Re-enter new password"
                                required
                            />
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !newPassword || !confirmPassword}
                            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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

            <p className="text-center text-white/30 text-sm mt-6">
                <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                    ← Back to login
                </Link>
            </p>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen grid md:grid-cols-2" style={{ backgroundColor: '#05070A' }}>
            {/* Left Side */}
            <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden">
                <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-8">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Home
                </Link>
                <div className="flex-1 flex flex-col justify-center">
                    <h1 className="text-5xl font-bold text-white mb-6">
                        Almost <br />
                        <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                            back in!
                        </span>
                    </h1>
                    <p className="text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Create a strong new password to secure your account.
                    </p>
                </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center justify-center p-8">
                <div className="max-w-md w-full">
                    <Suspense fallback={<div className="text-white text-center">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
