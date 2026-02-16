'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const urlError = searchParams.get('error');
  const [error, setError] = useState<string | null>(urlError ? `Authentication error: ${urlError}` : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

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

  const handleMagicLink = async () => {
    if (!email) {
      setError('Please enter your email address to receive a login link');
      return;
    }
    setMagicLinkLoading(true);
    setError(null);
    try {
      await signIn('email', { email, callbackUrl: '/dashboard' });
      // NextAuth default behavior is to redirect to verify request page
    } catch {
      setError('Failed to send magic link');
      setMagicLinkLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Welcome Back
        </h1>
        <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Sign in to continue your journey
        </p>
      </div>

      {/* Success Message */}
      {registered && (
        <div className="mb-6 p-4 bg-green-500/20 border border-green-400/30 rounded-lg text-green-200 text-center">
          🎉 Account created! Please sign in.
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full py-3 px-4 mb-6 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Sign in with Google
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px bg-white/20 flex-1" />
          <span className="text-sm text-purple-200 font-medium">OR</span>
          <div className="h-px bg-white/20 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white border border-pink-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="you@yourcentre.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white border border-pink-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Your password"
              // Password not required for magic link interaction, but strictly for this form submittal it's required for credentials
              required
            />
          </div>

          {(error || urlError) && (
            <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
              {error || (urlError && `Error: ${urlError}`)}
            </div>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading || magicLinkLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-xs text-purple-300">OR LOGIN WITHOUT PASSWORD</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading || magicLinkLoading}
              className="w-full py-3 rounded-lg bg-white/5 border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 text-sm"
            >
              {magicLinkLoading ? 'Sending Link...' : 'Email me a Login Link'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <Link href="/forgot-password" className="text-purple-300 hover:text-pink-400 text-sm">
            Forgot your password?
          </Link>
        </div>

        <hr className="my-6 border-white/20" />

        <p className="text-center text-purple-200">
          Don't have an account?{' '}
          <Link href="/signup" className="text-pink-400 hover:underline font-medium">
            Sign up free
          </Link>
        </p>
      </div>
    </>
  );
}

// ... imports

export default function LoginPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2" style={{ backgroundColor: '#05070A' }}>
      {/* Left Side - Marketing Content */}
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden">
        {/* Back to Home Link */}
        <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-8">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-blue-400 text-sm mb-6 w-fit">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            Top Rated Tuition Management
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold mb-6">
            Unlock Your <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Business Potential
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg mb-12" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Streamline bookings, manage students, and grow your tuition centre with our advanced management platform.
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-12">
            <div className="p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg mb-3" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold mb-1">500+</div>
              <div className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Active Centres</div>
            </div>

            <div className="p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg mb-3" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-2xl font-bold mb-1">50k+</div>
              <div className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Bookings Made</div>
            </div>

            <div className="p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg mb-3" style={{ background: 'rgba(234, 179, 8, 0.1)' }}>
                <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="text-2xl font-bold mb-1">4.9</div>
              <div className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Avg Rating</div>
            </div>
          </div>
        </div>

        {/* Scrolling Testimonials */}
        <div className="overflow-hidden relative">
          <div className="flex gap-6 animate-scroll-left">
            {/* Testimonial 1 */}
            <div className="flex-shrink-0 w-80 p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-cyan-500 flex items-center justify-center text-sm font-bold">
                  SC
                </div>
                <div>
                  <div className="font-semibold">Sarah Chen</div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                "SprintScale transformed how we manage our centre. The booking system is intuitive and our parents love it!"
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="flex-shrink-0 w-80 p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-sm font-bold">
                  JK
                </div>
                <div>
                  <div className="font-semibold">James Kim</div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                "Best investment we've made. Staff management and invoicing are now completely automated."
              </p>
            </div>

            {/* Duplicate for infinite scroll effect */}
            <div className="flex-shrink-0 w-80 p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-cyan-500 flex items-center justify-center text-sm font-bold">
                  SC
                </div>
                <div>
                  <div className="font-semibold">Sarah Chen</div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                "SprintScale transformed how we manage our centre. The booking system is intuitive and our parents love it!"
              </p>
            </div>
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
