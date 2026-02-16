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

      {/* Right Side - Signup Form */}
      <div className="flex items-center justify-center p-8">
        <div className="max-w-xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Get Started Free
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Create your account in seconds
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8 gap-4">
            {[
              { num: 1, label: 'Centre Details' },
              { num: 2, label: 'Contact Info' },
              { num: 3, label: 'Account' },
            ].map((item) => (
              <div
                key={item.num}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentStep === item.num
                    ? 'bg-blue-500/20 border-blue-400'
                    : currentStep > item.num
                      ? 'bg-green-500/10 border-green-400/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                style={{ border: '1px solid' }}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === item.num
                      ? 'bg-blue-500 text-white'
                      : currentStep > item.num
                        ? 'bg-green-500 text-white'
                        : 'bg-white/10 text-white/50'
                    }`}
                >
                  {currentStep > item.num ? '✓' : item.num}
                </div>
                <span
                  className={`text-sm hidden md:inline ${currentStep >= item.num ? 'text-white' : 'text-white/40'
                    }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-center">
                {error}
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Centre Name
                  </label>
                  <input
                    type="text"
                    value={formData.centreName}
                    onChange={(e) => setFormData({ ...formData, centreName: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your Tuition Centre"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Logo (Optional)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 hover:border-blue-400/50 rounded-lg p-6 text-center cursor-pointer transition-colors"
                  >
                    {logoPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="h-20 w-20 object-contain rounded"
                        />
                        <p className="text-sm text-white/60">Click to change logo</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <svg
                          className="w-10 h-10 text-white/40"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-white/60">Click to upload logo</p>
                        <p className="text-xs text-white/40">PNG, JPG up to 2MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </div>

                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!formData.centreName.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 py-3 px-4 bg-white/5 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    disabled={!formData.email.trim() || !formData.phone.trim()}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-5">
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="w-full py-3 px-4 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign up with Google
                </button>

                <div className="flex items-center gap-4">
                  <div className="h-px bg-white/20 flex-1" />
                  <span className="text-sm text-white/60 font-medium">OR</span>
                  <div className="h-px bg-white/20 flex-1" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.acceptedTerms}
                    onChange={(e) => setFormData({ ...formData, acceptedTerms: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="terms" className="text-sm text-white/60">
                    I agree to the{' '}
                    <Link href="/terms" className="text-blue-400 hover:text-blue-300">
                      Terms and Conditions
                    </Link>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 py-3 px-4 bg-white/5 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      !formData.password.trim() ||
                      formData.password !== formData.confirmPassword ||
                      !formData.acceptedTerms
                    }
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Account...' : 'Create Free Account'}
                  </button>
                </div>

                <p className="text-center text-sm text-white/60">
                  Already have an account?{' '}
                  <Link href="/login" className="text-blue-400 hover:text-blue-300">
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
{/* Header */ }
<div className="text-center mb-8">
  <h1 className="text-4xl font-bold text-white mb-2">
    Join SPRINTSCALE IT
  </h1>
  <p className="text-purple-200">
    Set up your tuition centre in minutes
  </p>
</div>

{/* Progress Steps */ }
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

{/* Form Card */ }
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
      </div >
    </div >
  );
}
