'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Something went wrong');
    } finally {
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
        <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Sign in to continue</p>
      </div>

      {registered && (
        <div className="mb-6 p-4 bg-green-500/20 border border-green-400/30 rounded-lg text-green-200 text-center">
          🎉 Account created! Please sign in.
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-white/20 mb-6">
        <button
          onClick={() => switchMode('admin')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'admin' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
            }`}
        >
          Admin / Owner
        </button>
        <button
          onClick={() => switchMode('staff')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'staff' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
            }`}
        >
          Staff Member
        </button>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">

        {/* ── ADMIN MODE ── */}
        {mode === 'admin' && (
          <>
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="w-full py-3 px-4 mb-6 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-white/20 flex-1" />
              <span className="text-sm text-white/50 font-medium">OR</span>
              <div className="h-px bg-white/20 flex-1" />
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white border border-blue-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@yourcentre.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white border border-blue-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <Link href="/forgot-password" className="block text-white/40 hover:text-white/70 text-sm transition-colors">
                Forgot your password?
              </Link>
              <p className="text-white/40 text-sm">
                Don't have an account?{' '}
                <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">Sign up free</Link>
              </p>
            </div>
          </>
        )}

        {/* ── STAFF MODE ── */}
        {mode === 'staff' && (
          <>
            {staffSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-500/20 border border-green-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Check your inbox</h3>
                <p className="text-white/60 text-sm mb-1">We've sent a login link to:</p>
                <p className="text-white font-medium mb-4">{staffEmail}</p>
                <p className="text-white/40 text-xs mb-6">The link expires in 15 minutes. Check your spam folder if you don't see it.</p>
                <button
                  onClick={() => { setStaffSent(false); setStaffEmail(''); }}
                  className="text-blue-400 hover:text-blue-300 text-sm underline transition-colors"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-blue-500/20 border border-blue-400/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-white/60 text-sm">
                    Enter your work email and we'll send you a one-click login link. No password needed.
                  </p>
                </div>

                <form onSubmit={handleStaffMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Work Email</label>
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white border border-blue-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="you@yourcentre.com"
                      required
                      autoFocus
                    />
                  </div>

                  {staffError && (
                    <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">{staffError}</div>
                  )}

                  <button
                    type="submit"
                    disabled={staffLoading || !staffEmail.trim()}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {staffLoading ? (
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

                <p className="text-center text-white/30 text-xs mt-6">
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
            Top Rated Tuition Management
          </div>

          <h1 className="text-5xl font-bold text-white mb-6">
            Unlock Your <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Business Potential
            </span>
          </h1>

          <p className="text-lg mb-12" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Streamline bookings, manage students, and grow your tuition centre with our advanced management platform.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '500+', label: 'Active Centres' },
              { value: '50k+', label: 'Bookings Made' },
              { value: '4.9', label: 'Avg Rating' },
            ].map((stat) => (
              <div key={stat.label} className="p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <Suspense fallback={<div className="text-white text-center">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
