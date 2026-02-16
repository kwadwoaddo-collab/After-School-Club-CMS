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
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
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
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#05070A' }}>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome Back
          </h1>
          <p className="text-purple-200">
            Sign in to your SPRINTSCALE IT account
          </p>
        </div>

        <Suspense fallback={<div className="text-white text-center">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
