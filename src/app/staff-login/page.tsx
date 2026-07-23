'use client';

import { useState } from 'react';
import { Mail, ArrowRight, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

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
            setError(err.message);
            setStep('error');
        }
    };

    if (step === 'sent') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Check your email!</h1>
                    <p className="text-white/60 mb-2">
                        We've sent a login link to:
                    </p>
                    <p className="text-white font-semibold mb-6">{email}</p>
                    <p className="text-white/40 text-sm">
                        Click the link in the email to sign in. It expires in 15 minutes.
                    </p>
                    <button
                        onClick={() => { setStep('form'); setEmail(''); }}
                        className="mt-6 text-white/50 hover:text-white text-sm underline transition-colors"
                    >
                        Use a different email
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
                    {/* Logo / Icon */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Staff Login</h1>
                        <p className="text-white/50 text-sm mt-1">
                            Enter your email to receive a sign-in link
                        </p>
                    </div>

                    {step === 'error' && (
                        <div className="p-4 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                                    placeholder="you@example.com"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={step === 'loading'}
                            className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {step === 'loading' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Sending link...
                                </>
                            ) : (
                                <>
                                    Send Login Link
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-white/30 text-xs mt-6">
                        Only pre-approved staff emails can log in.
                        <br />Contact your admin if you need access.
                    </p>
                </div>

                <div className="text-center mt-6">
                    <Link href="/login" className="text-white/40 hover:text-white/70 text-sm transition-colors">
                        Admin login →
                    </Link>
                </div>
            </div>
        </div>
    );
}
