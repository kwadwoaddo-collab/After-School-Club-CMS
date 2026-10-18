'use client';
import { logger } from '@/lib/logger';

import { useState, Suspense, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const inputClass =
  'w-full px-4 py-3 min-h-[44px] rounded-xl bg-[var(--if-surface)] border border-[var(--if-text-muted)] text-[var(--if-text)] placeholder:text-[var(--if-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--if-accent)] focus:border-[var(--if-accent)] font-medium';
const labelClass = 'block text-xs font-bold text-[var(--if-text-secondary)] mb-2 uppercase tracking-wider';
const primaryBtnClass =
  'w-full min-h-[44px] py-3 rounded-xl bg-[var(--if-accent)] text-white font-bold hover:bg-[var(--if-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2';
const linkClass =
  'text-[var(--if-accent)] hover:text-[var(--if-accent-hover)] font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)]';
const errorBoxClass =
  'p-3.5 bg-[var(--if-danger-soft)] border border-[var(--if-danger)] rounded-xl text-[var(--if-danger)] text-sm font-medium';
const noticeClass =
  'mb-6 p-4 bg-[var(--if-accent-soft)] border border-[var(--if-accent)] rounded-2xl text-[var(--if-text)] text-center text-sm font-medium';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const verified = searchParams.get('verified');
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
      const res = await fetch('/api/staff/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: staffEmail }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStaffError(data.error || 'Failed to send login link. Please try again.');
      } else {
        setStaffSent(true);
      }
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
        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--if-text)] mb-2 tracking-tight">Welcome Back</h1>
        <p className="text-sm font-medium text-[var(--if-text-secondary)]">Sign in to your After-School Club CMS</p>
      </div>

      {verified && (
        <div className={noticeClass} role="status">
          Email verified successfully! Please sign in.
        </div>
      )}

      {registered && !verified && (
        <div className={noticeClass} role="status">
          Account created successfully! Please check your email to verify your account, then sign in.
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex rounded-2xl overflow-hidden border border-[var(--if-border-subtle)] mb-6 bg-[var(--if-surface)] p-1 gap-1">
        <button
          type="button"
          onClick={() => switchMode('admin')}
          aria-pressed={mode === 'admin'}
          className={`flex-1 min-h-[44px] py-2.5 text-sm font-bold rounded-xl transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)] ${
            mode === 'admin'
              ? 'bg-[var(--if-accent)] text-white'
              : 'text-[var(--if-text-secondary)] hover:text-[var(--if-text)] hover:bg-[var(--if-accent-soft)]'
          }`}
        >
          Admin / Owner
        </button>
        <button
          type="button"
          onClick={() => switchMode('staff')}
          aria-pressed={mode === 'staff'}
          className={`flex-1 min-h-[44px] py-2.5 text-sm font-bold rounded-xl transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)] ${
            mode === 'staff'
              ? 'bg-[var(--if-accent)] text-white'
              : 'text-[var(--if-text-secondary)] hover:text-[var(--if-text)] hover:bg-[var(--if-accent-soft)]'
          }`}
        >
          Staff Member
        </button>
      </div>

      <div className="bg-[var(--if-surface-elevated)] rounded-3xl p-6 sm:p-8 border border-[var(--if-border-subtle)]">

        {/* ── ADMIN MODE ── */}
        {mode === 'admin' && (
          <>
            {/* Use Server Action for Google Sign-In to handle OAuth flow securely and prevent client-side CSRF mismatches */}
            <button
              onClick={async () => {
                if (googleLoading) return;
                setGoogleLoading(true);
                setGoogleError(null);
                try {
                  await signIn('google', { callbackUrl: '/dashboard' });
                } catch (err) {
                  logger.error('Google sign-in failed', err);
                  setGoogleError('Failed to sign in with Google. Please try again.');
                  setGoogleLoading(false);
                }
              }}
              disabled={googleLoading}
              type="button"
              className="w-full min-h-[44px] py-3 px-4 mb-2 rounded-xl bg-[var(--if-surface)] text-[var(--if-text)] border border-[var(--if-text-muted)] font-semibold hover:bg-[var(--if-accent-soft)] transition-colors duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]"
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
            {googleError && (
              <p className="text-[var(--if-danger)] text-xs text-center mb-4 mt-2" role="alert">{googleError}</p>
            )}

            <div className="flex items-center gap-4 mb-6 mt-4">
              <div className="h-px bg-[var(--if-border-subtle)] flex-1" />
              <span className="text-xs text-[var(--if-text-muted)] font-bold uppercase tracking-widest">or</span>
              <div className="h-px bg-[var(--if-border-subtle)] flex-1" />
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className={labelClass}>Email Address</label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@yourcentre.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-password" className={labelClass}>Password</label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className={errorBoxClass} role="alert">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={primaryBtnClass}
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
              <Link href="/forgot-password" className="block py-2 text-[var(--if-text-secondary)] hover:text-[var(--if-text)] text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)]">
                Forgot your password?
              </Link>
              <p className="text-[var(--if-text-secondary)] text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className={linkClass}>Sign up</Link>
              </p>
            </div>
          </>
        )}

        {/* ── STAFF MODE ── */}
        {mode === 'staff' && (
          <>
            {staffSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-[var(--if-accent-soft)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[var(--if-accent)]">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-[var(--if-text)] font-bold text-xl mb-2">Check your inbox</h3>
                <p className="text-[var(--if-text-secondary)] text-sm mb-1">We&apos;ve sent a login link to:</p>
                <p className="text-[var(--if-accent)] font-semibold mb-4 break-all">{staffEmail}</p>
                <p className="text-[var(--if-text-muted)] text-xs mb-6">The link expires in 15 minutes. Check your spam folder if you don&apos;t see it.</p>
                <button
                  type="button"
                  onClick={() => { setStaffSent(false); setStaffEmail(''); }}
                  className={`${linkClass} min-h-[44px] px-3 text-sm`}
                >
                  Use a different email →
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-[var(--if-accent-soft)] rounded-2xl flex items-center justify-center mx-auto mb-3 text-[var(--if-accent)]">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-[var(--if-text-secondary)] text-sm leading-relaxed">
                    Enter your work email and we&apos;ll send you a one-click login link. No password needed.
                  </p>
                </div>

                <form onSubmit={handleStaffMagicLink} className="space-y-4">
                  <div>
                    <label htmlFor="staff-email" className={labelClass}>Work Email</label>
                    <input
                      id="staff-email"
                      type="email"
                      autoComplete="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className={inputClass}
                      placeholder="you@yourcentre.com"
                      required
                      autoFocus
                    />
                  </div>

                  {staffError && (
                    <div className={errorBoxClass} role="alert">{staffError}</div>
                  )}

                  <button
                    type="submit"
                    disabled={staffLoading || !staffEmail.trim()}
                    className={primaryBtnClass}
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
                      'Send me a login link'
                    )}
                  </button>
                </form>

                <p className="text-center text-[var(--if-text-muted)] text-xs mt-6">
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

function BrandLockup() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 min-h-[44px] w-fit text-[var(--if-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)]" aria-label="After-School Club CMS · by SprintScale IT">
      <span className="w-9 h-9 rounded-lg bg-[var(--if-accent)] text-white inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
      <span className="flex flex-col leading-tight">
        <span className="font-bold text-sm">After-School Club CMS</span>
        <span className="text-xs text-[var(--if-text-muted)]">by SprintScale IT</span>
      </span>
    </Link>
  );
}

export default function LoginPage() {
  useEffect(() => {
    document.body.classList.add('landing-page-active');
    return () => {
      document.body.classList.remove('landing-page-active');
    };
  }, []);

  return (
    <div className="min-h-screen grid md:grid-cols-2 relative overflow-x-hidden bg-[var(--if-page)] text-[var(--if-text)]">

      {/* Left Side */}
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden bg-[var(--if-surface)] border-r border-[var(--if-border-subtle)]">
        <Link href="/" className="flex items-center gap-2 min-h-[44px] text-[var(--if-text-secondary)] hover:text-[var(--if-text)] transition-colors mb-8 w-fit focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="flex-1 flex flex-col justify-center">
          <BrandLockup />

          <h1 className="text-4xl lg:text-5xl font-extrabold text-[var(--if-text)] mt-10 mb-6 leading-tight tracking-tight">
            Run your club <br />
            <span className="text-[var(--if-accent)]">from one workspace</span>
          </h1>

          <p className="text-lg mb-10 leading-relaxed text-[var(--if-text-secondary)]">
            Sign in to manage sessions, student and family records, billing and staff register access.
          </p>

          <ul className="grid gap-3">
            {[
              'Session & class scheduling',
              'Student & family records',
              'Billing & family statements',
              'Staff & register access',
            ].map((item) => (
              <li key={item} className="p-4 rounded-2xl bg-[var(--if-surface-elevated)] border border-[var(--if-border-subtle)] text-sm font-medium text-[var(--if-text)]">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--if-border-subtle)]">
          <p className="text-xs text-[var(--if-text-muted)] font-medium">
            After-School Club CMS · by <a href="https://sprintscaleit.co.uk" className="font-bold text-[var(--if-text-secondary)] hover:text-[var(--if-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)]">SprintScale IT</a>
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-col items-center justify-between p-5 sm:p-8 relative min-w-0">
        <div className="md:hidden w-full flex justify-between items-center">
          <BrandLockup />
          <Link href="/" className="min-h-[44px] inline-flex items-center text-sm text-[var(--if-text-secondary)] hover:text-[var(--if-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--if-accent)]">
            Home
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="max-w-md w-full">
            <Suspense fallback={
              <div className="text-center text-[var(--if-text-muted)]">
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
          <p className="text-xs text-[var(--if-text-muted)] font-medium">
            After-School Club CMS · by <a href="https://sprintscaleit.co.uk" className="font-bold text-[var(--if-text-secondary)] underline-offset-2 hover:underline">SprintScale IT</a>
          </p>
        </div>
      </div>
    </div>
  );
}
