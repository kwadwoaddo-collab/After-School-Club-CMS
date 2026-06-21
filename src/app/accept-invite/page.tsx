'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { CheckCircle, XCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [step, setStep] = useState<'validating' | 'ready' | 'logging-in' | 'success' | 'error'>('validating');
    const [inviteData, setInviteData] = useState<{ email: string; name: string; role: string } | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const validateToken = async () => {
            try {
                const response = await fetch(`/api/staff/validate-invite?token=${token}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Invalid or expired invitation');
                }

                setInviteData(data);
                setStep('ready');
            } catch (err: any) {
                setError(err.message);
                setStep('error');
            }
        };

        if (!token) {
            setError('Invalid invitation link');
            setStep('error');
            return;
        }
        validateToken();
    }, [token]);

    const handleEnter = async () => {
        if (!token) return;
        setStep('logging-in');

        try {
            const result = await signIn('inviteToken', {
                token,
                redirect: false,
            });

            if (result?.error) {
                throw new Error('Failed to log in. The link may have already been used.');
            }

            setStep('success');
            // Use full page reload to ensure the new session is properly initialized
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } catch (err: any) {
            setError(err.message);
            setStep('error');
        }
    };

    const roleLabel = (role: string) =>
        role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Staff Member';

    if (step === 'validating') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-white/60 text-lg">Validating your invitation...</p>
                </div>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
                    <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Invitation Invalid</h1>
                    <p className="text-white/60 mb-6">{error}</p>
                    <p className="text-white/40 text-sm mb-6">
                        Contact your administrator to send a new invitation.
                    </p>
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
                    <h1 className="text-2xl font-bold text-white mb-2">Welcome aboard!</h1>
                    <p className="text-white/60 mb-4">Taking you to your dashboard...</p>
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 text-center shadow-2xl">
                    {/* Icon */}
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Sparkles className="w-10 h-10 text-white" />
                    </div>

                    {/* Heading */}
                    <h1 className="text-3xl font-bold text-white mb-2">You're invited!</h1>
                    <p className="text-white/60 mb-6">
                        You've been added to the team as a{' '}
                        <span className="font-semibold text-white">{roleLabel(inviteData?.role || '')}</span>.
                    </p>

                    {/* Email badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/80 text-sm mb-8 border border-white/20">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        {inviteData?.email}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleEnter}
                        disabled={step === 'logging-in'}
                        className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg rounded-2xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {step === 'logging-in' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Signing you in...
                            </>
                        ) : (
                            <>
                                Enter Dashboard
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    <p className="text-white/30 text-xs mt-6">
                        This link is single-use and expires in 15 minutes.
                        For future logins, use the staff login page.
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-white/30 text-sm mt-6">
                    Powered by SprintScale
                </p>
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
