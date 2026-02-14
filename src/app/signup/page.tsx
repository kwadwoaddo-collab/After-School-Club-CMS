'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signIn } from 'next-auth/react';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    organisationName: '',
    firstName: '',
    lastName: '',
    contactEmail: '',
    password: '',
    confirmPassword: '',
    contactPhone: '',
    website: '',
    privacyPolicyUrl: '',
    address: '',
    description: '',
    logoUrl: '',
    termsAccepted: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    console.log(`Updating field: ${field} =`, value);
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        updateField('logoUrl', data.url);
      } else {
        setError(data.error || 'Failed to upload logo');
      }
    } catch {
      setError('Failed to upload logo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.log('Submitting Signup Form with Data:', formData);

    // Validate
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!formData.termsAccepted) {
      setError('Please accept the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/organisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      console.log('Signup API Response:', data);

      if (data.success) {
        // Redirect to login with success message
        router.push('/login?registered=true');
      } else {
        setError(data.error || 'Failed to create account');
      }
    } catch (err) {
      console.error('Signup Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Join SPRINTSCALE IT
          </h1>
          <p className="text-purple-200">
            Set up your tuition centre in minutes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8 gap-4">
          {[
            { num: 1, label: 'Centre Details' },
            { num: 2, label: 'Contact Info' },
            { num: 3, label: 'Account' }
          ].map((s) => (
            <div key={s.num} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all mb-2
                  ${step >= s.num ? 'bg-white text-purple-900' : 'bg-purple-800/50 text-purple-300'}`}
              >
                {s.num}
              </div>
              <span className={`text-xs font-medium ${step >= s.num ? 'text-white' : 'text-purple-400'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          {/* Google Sign Up */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/onboarding' })}
              className="w-full py-3 px-4 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Sign up with Google
            </button>
            <p className="text-center text-purple-200 text-xs mt-2">
              You’ll set up your tuition centre details next
            </p>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="h-px bg-white/20 flex-1" />
            <span className="text-sm text-purple-200 font-medium">OR REGISTER WITH EMAIL</span>
            <div className="h-px bg-white/20 flex-1" />
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Organisation Details */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold text-white mb-4">Organisation Details</h2>

                <div>
                  <label htmlFor="organisationName" className="block text-sm font-medium text-purple-200 mb-1">
                    Tuition Centre Name *
                  </label>
                  <input
                    id="organisationName"
                    name="organisationName"
                    type="text"
                    value={formData.organisationName}
                    onChange={(e) => updateField('organisationName', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="e.g. My Tuition Centre"
                    autoComplete="organization"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="logo" className="block text-sm font-medium text-purple-200 mb-1">
                    Logo <span className="text-purple-400 font-normal">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-purple-300 text-3xl">📷</span>
                      )}
                    </div>
                    <div>
                      <input
                        id="logo"
                        name="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="text-sm text-purple-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-500 file:text-white hover:file:bg-pink-600 mb-1"
                      />
                      <p className="text-xs text-purple-300">You can add or change this later.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-purple-200 mb-1">
                    Description <span className="text-purple-400 font-normal">(Optional - 1-2 sentences)</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="e.g. We provide Maths and English tuition for ages 5–11..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Contact & Links */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold text-white mb-4">Contact Information</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contactPhone" className="block text-sm font-medium text-purple-200 mb-1">
                      Phone Number
                    </label>
                    <input
                      id="contactPhone"
                      name="contactPhone"
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => updateField('contactPhone', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="020 1234 5678"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label htmlFor="website" className="block text-sm font-medium text-purple-200 mb-1">
                      Website
                    </label>
                    <input
                      id="website"
                      name="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => updateField('website', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="https://..."
                      autoComplete="url"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-purple-200 mb-1">
                    Business Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="Full address..."
                    rows={2}
                    autoComplete="street-address"
                  />
                  <p className="text-xs text-purple-300 mt-1">You can update this later.</p>
                </div>

                <div>
                  <label htmlFor="privacyPolicyUrl" className="block text-sm font-medium text-purple-200 mb-1">
                    Privacy Policy URL
                  </label>
                  <input
                    id="privacyPolicyUrl"
                    name="privacyPolicyUrl"
                    type="url"
                    value={formData.privacyPolicyUrl}
                    onChange={(e) => updateField('privacyPolicyUrl', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="https://yoursite.com/privacy"
                  />
                  <p className="text-xs text-purple-300 mt-1">Required for GDPR compliance</p>
                </div>
              </div>
            )}

            {/* Step 3: Account Setup */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold text-white mb-4">Your Account</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-purple-200 mb-1">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="John"
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-purple-200 mb-1">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="Smith"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contactEmail" className="block text-sm font-medium text-purple-200 mb-1">
                    Email Address *
                  </label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="you@yourcentre.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-1">
                      Password *
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-purple-200 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4 mt-4">
                  <p className="text-green-300 font-medium">🎉 Free Tier Subscription</p>
                  <p className="text-green-200 text-sm">No payment required. Start using all features immediately!</p>
                </div>

                <label htmlFor="termsAccepted" className="flex items-center gap-3 cursor-pointer">
                  <input
                    id="termsAccepted"
                    name="termsAccepted"
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={(e) => updateField('termsAccepted', e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-pink-500 focus:ring-pink-500"
                  />
                  <span className="text-purple-200 text-sm">
                    I agree to the <a href="/terms" className="text-pink-400 underline">Terms of Service</a> and <a href="/privacy" className="text-pink-400 underline">Privacy Policy</a>
                  </span>
                </label>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col gap-4 mt-8">
              <div className="flex gap-4">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="flex-1 py-3 rounded-lg bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
                  >
                    Back
                  </button>
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 1 && !formData.organisationName) {
                        setError('Please enter your organisation name');
                        return;
                      }
                      setStep(step + 1);
                    }}
                    disabled={step === 1 && !formData.organisationName.trim()}
                    className="flex-1 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || !formData.termsAccepted}
                    className="flex-1 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Account...' : 'Create Account & Start Free'}
                  </button>
                )}
              </div>

              {/* Trust Signal */}
              <p className="text-center text-purple-300 text-xs">
                No credit card required. You can change these details later.
              </p>
            </div>

          </form>
          {/* Login Link */}
          <p className="text-center text-purple-200 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-pink-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
