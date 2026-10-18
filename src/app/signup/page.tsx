'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';
const inputClass =
  'w-full px-4 py-3 min-h-[44px] bg-[var(--if-surface)] text-[var(--if-text)] border border-[var(--if-text-muted)] rounded-lg placeholder:text-[var(--if-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--if-accent)] focus:border-[var(--if-accent)]';
const labelClass = 'block text-sm font-medium text-[var(--if-text-secondary)] mb-2';
const primaryBtnClass = `w-full min-h-[44px] py-3 px-4 bg-[var(--if-accent)] text-white font-bold rounded-lg hover:bg-[var(--if-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;
const linkClass = `text-[var(--if-accent)] hover:text-[var(--if-accent-hover)] underline underline-offset-2 ${focusRing}`;

function BrandLockup() {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 min-h-[44px] w-fit text-[var(--if-text)] ${focusRing}`} aria-label="After-School Club CMS · by SprintScale IT">
      <span className="w-9 h-9 rounded-lg bg-[var(--if-accent)] text-white inline-flex items-center justify-center font-bold text-lg" aria-hidden="true">S</span>
      <span className="flex flex-col leading-tight text-left">
        <span className="font-bold text-sm">After-School Club CMS</span>
        <span className="text-xs text-[var(--if-text-muted)]">by SprintScale IT</span>
      </span>
    </Link>
  );
}

export default function SignupPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Google OAuth loading + error state — prevents double-click OAuth flows
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });

  const handleSubmit = async () => {
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!formData.acceptedTerms) {
      setError('Please accept the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      // 1. Create the account
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          acceptedTerms: formData.acceptedTerms,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Signup failed');
      }

      // 2. Direct to login with registration confirmation
      router.push('/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Your Details' },
    { num: 2, label: 'Account' },
  ];

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[var(--if-page)] text-[var(--if-text)] overflow-x-hidden">
      {/* Left Side - Product Content */}
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden bg-[var(--if-surface)] border-r border-[var(--if-border-subtle)]">
        <Link href="/" className={`flex items-center gap-2 min-h-[44px] w-fit text-[var(--if-text-secondary)] hover:text-[var(--if-text)] transition-colors mb-8 ${focusRing}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="flex-1 flex flex-col justify-center">
          <BrandLockup />

          <h1 className="text-4xl lg:text-5xl font-bold mt-10 mb-6">
            Set up your <br />
            <span className="text-[var(--if-accent)]">club workspace</span>
          </h1>

          <p className="text-lg mb-10 text-[var(--if-text-secondary)]">
            Create an administrator account to manage sessions, student and family records, billing and staff access.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
            {[
              { value: 'Scheduling', label: 'Sessions & classes' },
              { value: 'Registers', label: 'Staff register access' },
              { value: 'Billing', label: 'Invoices & statements' },
            ].map((stat) => (
              <div key={stat.label} className="p-5 rounded-xl bg-[var(--if-surface-elevated)] border border-[var(--if-border-subtle)]">
                <div className="text-lg font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-[var(--if-text-secondary)]">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* What happens next */}
          <div className="space-y-4">
            <p className="text-[var(--if-text-muted)] text-xs uppercase tracking-widest font-semibold">After signing up you&apos;ll</p>
            {[
              'Set up your organisation name',
              'Create your first centre',
              'Choose your brand colour',
              'Invite your team',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--if-accent-soft)] text-[var(--if-accent)] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[var(--if-text-secondary)] text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 pt-6 border-t border-[var(--if-border-subtle)] text-xs text-[var(--if-text-muted)]">
          After-School Club CMS · by <a href="https://sprintscaleit.co.uk" className={`font-bold text-[var(--if-text-secondary)] hover:text-[var(--if-accent)] hover:underline ${focusRing}`}>SprintScale IT</a>
        </p>
      </div>

      {/* Right Side - Signup Form */}
      <div className="flex flex-col items-center justify-center p-5 sm:p-8 min-w-0">
        <div className="md:hidden w-full flex justify-between items-center mb-6">
          <BrandLockup />
          <Link href="/" className={`min-h-[44px] inline-flex items-center text-sm text-[var(--if-text-secondary)] hover:text-[var(--if-text)] ${focusRing}`}>Home</Link>
        </div>
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Create your account</h2>
            <p className="text-sm text-[var(--if-text-secondary)]">
              Create an administrator account to start setting up your centre
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8 gap-4">
            {steps.map((item) => (
              <div
                key={item.num}
                aria-current={currentStep === item.num ? 'step' : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === item.num
                    ? 'bg-[var(--if-accent-soft)] border-[var(--if-accent)]'
                    : currentStep > item.num
                      ? 'bg-[var(--if-accent-soft)] border-[var(--if-border-subtle)]'
                      : 'bg-[var(--if-surface)] border-[var(--if-border-subtle)]'
                  }`}
                style={{ border: '1px solid' }}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep >= item.num
                      ? 'bg-[var(--if-accent)] text-white'
                      : 'bg-[var(--if-border-subtle)] text-[var(--if-text-muted)]'
                    }`}
                >
                  {currentStep > item.num ? '✓' : item.num}
                </div>
                <span className={`text-sm hidden sm:inline ${currentStep >= item.num ? 'text-[var(--if-text)]' : 'text-[var(--if-text-muted)]'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="bg-[var(--if-surface-elevated)] rounded-2xl p-6 sm:p-8 border border-[var(--if-border-subtle)]">
            {error && (
              <div role="alert" className="mb-6 p-4 bg-[var(--if-danger-soft)] border border-[var(--if-danger)] rounded-lg text-[var(--if-danger)] text-sm text-center">
                {error}
              </div>
            )}

            {/* Google Sign Up */}
            <div className="mb-6">
              <button
                onClick={async () => {
                  if (googleLoading) return;
                  setGoogleLoading(true);
                  setGoogleError('');
                  try {
                    await signIn('google', { callbackUrl: '/onboarding' });
                  } catch (err) {
                    logger.error('Google sign-in failed', err);
                    setGoogleError('Could not open Google sign-in. Please try again.');
                    setGoogleLoading(false);
                  }
                }}
                disabled={googleLoading}
                type="button"
                className={`w-full min-h-[44px] py-3 px-4 rounded-lg bg-[var(--if-surface)] text-[var(--if-text)] border border-[var(--if-text-muted)] font-semibold hover:bg-[var(--if-accent-soft)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${focusRing}`}
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
                <p className="text-[var(--if-danger)] text-xs text-center mt-2" role="alert">{googleError}</p>
              )}
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-[var(--if-border-subtle)] flex-1" />
              <span className="text-sm text-[var(--if-text-muted)] font-medium">OR</span>
              <div className="h-px bg-[var(--if-border-subtle)] flex-1" />
            </div>

            {/* Step 1 — Your Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className={labelClass}>First Name</label>
                    <input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className={inputClass}
                      placeholder="Jane"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={labelClass}>Last Name</label>
                    <input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className={inputClass}
                      placeholder="Smith"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>Work Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="jane@yourcentre.com"
                    required
                  />
                </div>

                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()}
                  type="button"
                  className={primaryBtnClass}
                >
                  Continue
                </button>

                <p className="text-center text-sm text-[var(--if-text-secondary)]">
                  Already have an account?{' '}
                  <Link href="/login" className={linkClass}>
                    Sign in
                  </Link>
                </p>
              </div>
            )}

            {/* Step 2 — Password */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="new-password" className={labelClass}>Password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={inputClass}
                    placeholder="Min. 8 characters"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className={labelClass}>Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={inputClass}
                    placeholder="••••••••"
                    required
                  />
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-[var(--if-danger)] text-xs mt-1">Passwords don&apos;t match</p>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.acceptedTerms}
                    onChange={(e) => setFormData({ ...formData, acceptedTerms: e.target.checked })}
                    className={`mt-1 w-5 h-5 rounded accent-[var(--if-accent)] ${focusRing}`}
                  />
                  <label htmlFor="terms" className="text-sm text-[var(--if-text-secondary)]">
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className={linkClass}>
                      Terms of Service
                    </Link>{' '}
                    and acknowledge the{' '}
                    <Link href="/privacy" target="_blank" className={linkClass}>
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className={`flex-1 min-h-[44px] py-3 px-4 bg-[var(--if-surface)] border border-[var(--if-text-muted)] text-[var(--if-text)] font-semibold rounded-lg hover:bg-[var(--if-accent-soft)] transition-colors ${focusRing}`}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      formData.password.length < 8 ||
                      formData.password !== formData.confirmPassword ||
                      !formData.acceptedTerms
                    }
                    className={`flex-1 min-h-[44px] py-3 px-4 bg-[var(--if-accent)] text-white font-bold rounded-lg hover:bg-[var(--if-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`}
                  >
                    {loading ? 'Creating account...' : 'Create Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
