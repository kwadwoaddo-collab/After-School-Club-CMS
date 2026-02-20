'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

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
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            // Always show success (prevents email enumeration)
            setSent(true);
        } catch (err: any) {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

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
                    <div className="inline-flex items-center gap-2 text-blue-400 text-sm mb-6 w-fit">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        Account Recovery
                    </div>
                    <h1 className="text-5xl font-bold text-white mb-6">
                        Get back <br />
                        <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                            into your account
                        </span>
                    </h1>
                    <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        If you signed up with Google, just click <strong className="text-white">"Sign in with Google"</strong> — no password needed.
                    </p>
                    <div className="p-5 rounded-2xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <p className="text-blue-300 text-sm leading-relaxed">
                            💡 <strong>Most admins sign in with Google.</strong> If you registered with a Google account (Gmail, Workspace, etc.), just use the Google Sign-In button — no password recovery needed.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center justify-center p-8">
                <div className="max-w-md w-full">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-2">Forgot Password?</h2>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            No problem — choose how you signed in originally
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 space-y-6">

                        {/* Google Sign-In Option */}
                        <div>
                            <p className="text-white/60 text-sm text-center mb-3">Signed up with Google?</p>
                            <button
                                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                                className="w-full py-3 px-4 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Sign in with Google
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-px bg-white/20 flex-1" />
                            <span className="text-sm text-white/40 font-medium">OR</span>
                            <div className="h-px bg-white/20 flex-1" />
                        </div>

                        {/* Magic Link Option */}
                        {sent ? (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-green-500/20 border border-green-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">Check your inbox!</h3>
                                <p className="text-white/60 text-sm mb-1">We've sent a password reset link to:</p>
                                <p className="text-white font-medium mb-4">{email}</p>
                                <p className="text-white/40 text-xs mb-6">The link expires in 1 hour. Check your spam folder if you don't see it.</p>
                                <button
                                    onClick={() => { setSent(false); setEmail(''); }}
                                    className="text-blue-400 hover:text-blue-300 text-sm underline transition-colors"
                                >
                                    Try a different email
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-white/60 text-sm text-center mb-3">Used email & password? Get a magic login link:</p>
                                <form onSubmit={handleSendMagicLink} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg bg-white border border-blue-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="you@yourcentre.com"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">{error}</div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || !email.trim()}
                                        className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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

                    <p className="text-center text-white/30 text-sm mt-6">
                        Remember your password?{' '}
                        <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                            Back to login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
