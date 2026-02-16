'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [step, setStep] = useState<'validating' | 'form' | 'success' | 'error'>('validating');
    const [inviteData, setInviteData] = useState<any>(null);
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('Invalid invitation link');
            setStep('error');
            return;
        }

        // Validate the token
        validateToken();
    }, [token]);

    const validateToken = async () => {
        try {
            const response = await fetch(`/api/staff/validate-invite?token=${token}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Invalid or expired invitation');
            }

            setInviteData(data);
            setStep('form');
        } catch (err: any) {
            setError(err.message);
            setStep('error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/staff/accept-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    ...formData,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to accept invitation');
            }

            setStep('success');

            // Redirect to login after 2 seconds
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    if (step === 'validating') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Validating invitation...</p>
                </div>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
                    <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
                    <p className="text-white/60 mb-6">{error}</p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
                    >
                        Go to Homepage
                    </Link>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Account Created!</h1>
                    <p className="text-white/60 mb-6">
                        Your account has been created successfully. Redirecting you to login...
                    </p>
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome to the Team!</h1>
                    <p className="text-white/60">
                        You've been invited to join as a{' '}
                        <span className="font-semibold text-white">{inviteData?.role?.replace('_', ' ')}</span>
                    </p>
                    <div className="mt-4 flex items-center gap-2 justify-center text-white/80">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">{inviteData?.email}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">First Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="John"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Last Name</label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Doe"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <p className="text-xs text-white/50 mt-1">Must be at least 8 characters</p>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating Account...
                            </div>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        }>
            <AcceptInviteContent />
        </Suspense>
    );
}
