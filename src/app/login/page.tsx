'use client';

import { useState, Suspense, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signInWithGoogle } from '@/app/actions/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const urlError = searchParams.get('error');

  const [mode, setMode] = useState<'admin' | 'staff'>('admin');

  // Admin state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError ? `Authentication error: ${urlError}` : null);

  // Google Sign-In state — mounted gates the button until hydration
  const [mounted, setMounted] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Staff magic link state
  const [staffEmail, setStaffEmail] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSent, setStaffSent] = useState(false);
  const [staffError, setStaffError] = useState('');

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/dashboard'
      });
      if (result?.error) {
        setError('Invalid email or password');
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Something went wrong');
      setLoading(false);
    }
  };

  const handleStaffMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffLoading(true);
    setStaffError('');
    try {
      await fetch('/api/staff/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: staffEmail }),
      });
      setStaffSent(true);
    } catch {
      setStaffError('Failed to send login link. Please try again.');
    } finally {
      setStaffLoading(false);
    }
  };

  const switchMode = (newMode: 'admin' | 'staff') => {
    setMode(newMode);
    setError(null);
    setStaffError('');
    setStaffSent(false);
  };

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#adc6ff]/20 to-[#8b5cf6]/15 border border-[#adc6ff]/20 flex items-center justify-center mx-auto mb-5 shadow-[0_0_24px_rgba(173,198,255,0.2)]">
          <span className="text-2xl">🚀</span>
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Welcome Back</h1>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Sign in to your SprintScale dashboard</p>
      </div>

      {registered && (
        <div className="mb-6 p-4 bg-emerald-500/15 border border-emerald-400/25 rounded-2xl text-emerald-300 text-center text-sm font-medium">
          🎉 Account created successfully! Please sign in.
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex rounded-2xl overflow-hidden border border-white/10 mb-6 bg-white/3 p-1 gap-1">
        <button
          onClick={() => switchMode('admin')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
            mode === 'admin'
              ? 'bg-[#adc6ff] text-[#001e58] shadow-[0_2px_8px_rgba(173,198,255,0.3)]'
              : 'text-[#8c909f] hover:text-white hover:bg-white/5'
          }`}
        >
          Admin / Owner
        </button>
        <button
          onClick={() => switchMode('staff')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
            mode === 'staff'
              ? 'bg-[#adc6ff] text-[#001e58] shadow-[0_2px_8px_rgba(173,198,255,0.3)]'
              : 'text-[#8c909f] hover:text-white hover:bg-white/5'
          }`}
        >
          Staff Member
        </button>
      </div>

      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-white/10">

        {/* ── ADMIN MODE ── */}
        {mode === 'admin' && (
          <>
            {/* Use Server Action for Google Sign-In to handle OAuth flow securely and prevent client-side CSRF mismatches */}
            <form action={() => signInWithGoogle('/dashboard')} className="w-full">
              <button
                type="submit"
                onClick={() => setGoogleLoading(true)}
                disabled={googleLoading}
                className="w-full py-3.5 px-4 mb-2 rounded-2xl bg-white/8 text-white border border-white/12 font-semibold hover:bg-white/12 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:border-white/20 hover:shadow-[0_4px_12px_rgba(255,255,255,0.05)]"
              >
                {googleLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Opening Google…
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </form>
            {googleError && (
              <p className="text-red-300 text-xs text-center mb-4 mt-2">{googleError}</p>
            )}

            <div className="flex items-center gap-4 mb-6 mt-4">
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-xs text-white/30 font-bold uppercase tracking-widest">or</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-medium transition-all"
                  placeholder="you@yourcentre.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-medium transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/15 border border-red-400/25 rounded-xl text-red-300 text-sm font-medium">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-bold hover:from-[#4f93ff] hover:to-[#7c7fff] transition-all duration-200 shadow-[0_4px_16px_rgba(59,130,246,0.4)] hover:shadow-[0_6px_24px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <Link href="/forgot-password" className="block text-white/30 hover:text-white/60 text-sm transition-colors">
                Forgot your password?
              </Link>
              <p className="text-white/30 text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-[#adc6ff] hover:text-[#6b9dff] font-semibold transition-colors">Sign up free</Link>
              </p>
            </div>
          </>
        )}

        {/* ── STAFF MODE ── */}
        {mode === 'staff' && (
          <>
            {staffSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-400/25 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(52,211,153,0.2)]">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-xl mb-2">Check your inbox ✉️</h3>
                <p className="text-white/50 text-sm mb-1">We&apos;ve sent a login link to:</p>
                <p className="text-[#adc6ff] font-semibold mb-4">{staffEmail}</p>
                <p className="text-white/30 text-xs mb-6">The link expires in 15 minutes. Check your spam folder if you don&apos;t see it.</p>
                <button
                  onClick={() => { setStaffSent(false); setStaffEmail(''); }}
                  className="text-[#adc6ff] hover:text-[#6b9dff] text-sm font-semibold transition-colors"
                >
                  Use a different email →
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-blue-500/15 border border-blue-400/25 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Enter your work email and we&apos;ll send you a one-click login link. No password needed.
                  </p>
                </div>

                <form onSubmit={handleStaffMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Work Email</label>
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-medium transition-all"
                      placeholder="you@yourcentre.com"
                      required
                      autoFocus
                    />
                  </div>

                  {staffError && (
                    <div className="p-3.5 bg-red-500/15 border border-red-400/25 rounded-xl text-red-300 text-sm font-medium">{staffError}</div>
                  )}

                  <button
                    type="submit"
                    disabled={staffLoading || !staffEmail.trim()}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-bold hover:from-[#4f93ff] hover:to-[#7c7fff] transition-all duration-200 shadow-[0_4px_16px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {staffLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      'Send me a login link ✉️'
                    )}
                  </button>
                </form>

                <p className="text-center text-white/25 text-xs mt-6">
                  Only invited staff members can log in this way.
                  <br />Contact your admin if you need access.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2 relative overflow-hidden" style={{ backgroundColor: '#05070A' }}>

      {/* Animated gradient background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/2 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute -bottom-20 left-1/4 w-64 h-64 bg-indigo-600/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      </div>

      {/* Left Side */}
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden">
        <Link href="/" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors mb-8 group w-fit">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6 w-fit bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            Trusted by Tuition Centres
          </div>

          <h1 className="text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            Unlock Your <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Business Potential
            </span>
          </h1>

          <p className="text-lg mb-12 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Streamline bookings, manage students, and grow your tuition centre with our advanced management platform.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '500+', label: 'Active Centres' },
              { value: '50k+', label: 'Bookings Made' },
              { value: '4.9', label: 'Avg Rating' },
            ].map((stat) => (
              <div key={stat.label} className="p-5 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-2xl font-extrabold text-white mb-1">{stat.value}</div>
                <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Powered by footer */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-xs text-white/20 font-medium">
            Powered by <span className="text-white/40 font-bold">SprintScale IT</span> · Enterprise-grade security
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-col items-center justify-between p-8 relative">
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="max-w-md w-full">
            <Suspense fallback={
              <div className="text-center text-white/40">
                <svg className="w-8 h-8 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            }>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        {/* Powered by — mobile only */}
        <div className="md:hidden mt-8 text-center">
          <p className="text-xs text-white/20 font-medium">
            Powered by <span className="text-white/35 font-bold">SprintScale IT</span>
          </p>
        </div>
      </div>
    </div>
  );
}
