'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import "./landing.css";

export default function Home() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleFaq = (index: number) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    return (
        <div className="landing-page">
            {/* Sticky Navbar */}
            <nav className={`landing-navbar ${isScrolled ? 'scrolled' : ''}`}>
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-xl">🚀</span>
                        </div>
                        <span className="text-xl font-bold">SprintScale</span>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                        <a href="#features" className="landing-navbar-link">Features</a>
                        <a href="#how-it-works" className="landing-navbar-link">How It Works</a>
                        <a href="#pricing" className="landing-navbar-link">Pricing</a>
                        <a href="#faq" className="landing-navbar-link">FAQ</a>
                        <Link href="/login" className="btn-login">
                            Login
                        </Link>
                    </div>
                    {/* Mobile menu button - simplified */}
                    <Link href="/login" className="md:hidden btn-login">
                        Login
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="landing-section text-center" style={{ paddingTop: '8rem' }}>
                <div className="max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full"
                        style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)'
                        }}>
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-medium">Access for Tuition Centres</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                        The One-Stop Shop to<br />
                        <span className="gradient-text">Manage Your Tuition Business</span>
                    </h1>

                    <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto"
                        style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Streamline bookings, student registrations, invoicing, and staff management—all in one place.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
                        <Link href="/signup" className="btn-primary-landing">
                            Get Started for Free
                        </Link>
                        <a href="#features" className="btn-outline-landing">
                            Explore Features
                        </a>
                    </div>
                </div>
            </section>

            {/* Features Section - Built for Growth */}
            <section id="features" className="landing-section">
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for Growth</h2>
                    <p className="text-xl" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Everything you need to scale your tuition business
                    </p>
                </div>

                <div className="feature-grid">
                    <div className="feature-card">
                        <div className="feature-icon orange">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-3">Smart Bookings</h3>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            Automate assessment scheduling and class bookings with intelligent calendar management
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon purple">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-3">Easy Registration</h3>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            Digital enrollment forms with automated student data management
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon green">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                <line x1="1" y1="10" x2="23" y2="10"></line>
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-3">Auto Invoicing</h3>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            Automated billing and payment tracking to keep your cash flow healthy
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon pink">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-3">Staff Portal</h3>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            Manage tutors, track shifts, and streamline payroll in one place
                        </p>
                    </div>
                </div>
            </section>

            {/* How It Works - Process Timeline */}
            <section id="how-it-works" className="landing-section" style={{ background: 'rgba(59, 130, 246, 0.02)' }}>
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
                    <p className="text-xl" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Get started in 3 simple steps
                    </p>
                </div>

                <div className="process-timeline">
                    <div className="process-step">
                        <div className="process-number">1</div>
                        <h3 className="text-2xl font-bold mb-3">Register Organization</h3>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            Create your tuition centre account and set up your organization profile in minutes
                        </p>
                    </div>

                    <div className="process-step">
                        <div className="process-number">2</div>
                        <h3 className="text-2xl font-bold mb-3">Set Your Availability</h3>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            Configure your class schedules, tutor availability, and booking preferences
                        </p>
                    </div>

                    <div className="process-step">
                        <div className="process-number">3</div>
                        <h3 className="text-2xl font-bold mb-3">Onboard Your Parents</h3>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            Share your booking link and start accepting student registrations instantly
                        </p>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="landing-section">
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h2>
                    <p className="text-xl" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Start free, upgrade when you're ready
                    </p>
                </div>

                <div className="pricing-grid">
                    {/* Free Starter */}
                    <div className="pricing-card active">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold mb-2">Free Starter</h3>
                            <div className="text-4xl font-bold mb-4">
                                <span className="gradient-text">$0</span>
                            </div>
                            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                Perfect for getting started
                            </p>
                        </div>

                        <ul className="mb-8 space-y-3">
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Up to 50 students</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Basic booking management</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Digital registration forms</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Email support</span>
                            </li>
                        </ul>

                        <Link href="/signup" className="btn-primary-landing w-full text-center">
                            Get Started Free
                        </Link>
                    </div>

                    {/* Pro Creator - Coming Soon */}
                    <div className="pricing-card locked">
                        <span className="coming-soon-badge">Coming Soon</span>
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold mb-2">Pro Creator</h3>
                            <div className="text-4xl font-bold mb-4">
                                <span className="gradient-text">•••</span>
                            </div>
                            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                For growing centres
                            </p>
                        </div>

                        <ul className="mb-8 space-y-3">
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Unlimited students</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Advanced analytics</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Automated invoicing</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Priority support</span>
                            </li>
                        </ul>

                        <button disabled className="btn-primary-landing w-full text-center opacity-50 cursor-not-allowed">
                            Coming Soon
                        </button>
                    </div>

                    {/* Enterprise - Coming Soon */}
                    <div className="pricing-card locked">
                        <span className="coming-soon-badge">Coming Soon</span>
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                            <div className="text-4xl font-bold mb-4">
                                <span className="gradient-text">•••</span>
                            </div>
                            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                For large organizations
                            </p>
                        </div>

                        <ul className="mb-8 space-y-3">
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Everything in Pro</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Multi-location support</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Custom integrations</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Dedicated account manager</span>
                            </li>
                        </ul>

                        <button disabled className="btn-primary-landing w-full text-center opacity-50 cursor-not-allowed">
                            Coming Soon
                        </button>
                    </div>
                </div>
            </section>

            {/* Social Proof - Testimonials */}
            <section className="landing-section" style={{ background: 'rgba(139, 92, 246, 0.02)' }}>
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">Loved by Organizations</h2>
                </div>

                <div className="testimonial-card">
                    <div className="flex justify-center mb-6">
                        <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                                <svg key={i} className="w-6 h-6" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            ))}
                        </div>
                    </div>
                    <p className="text-2xl mb-6" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        "SprintScale has transformed how we manage our tuition centre. The automated booking system alone has saved us 10+ hours per week!"
                    </p>
                    <div>
                        <p className="font-bold text-lg">Sarah Johnson</p>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Director, ABC Learning Centre</p>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="landing-section">
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h2>
                </div>

                <div className="max-w-3xl mx-auto">
                    {[
                        {
                            question: "Is the free plan really free forever?",
                            answer: "Yes! Our Free Starter plan is completely free with no hidden costs. You can manage up to 50 students and access core features without any time limits."
                        },
                        {
                            question: "Can I upgrade or downgrade my plan later?",
                            answer: "Absolutely! Once our paid plans launch, you'll be able to upgrade or downgrade at any time. Your data stays safe throughout the process."
                        },
                        {
                            question: "How secure is my student data?",
                            answer: "We take security seriously. All data is encrypted in transit and at rest. We comply with GDPR and other data protection regulations to keep your information safe."
                        },
                        {
                            question: "Do you offer customer support?",
                            answer: "Yes! Free plan users get email support, while paid plans (coming soon) will include priority support and dedicated account management for Enterprise customers."
                        },
                        {
                            question: "Can I use SprintScale for multiple locations?",
                            answer: "Multi-location support will be available in our Enterprise plan (coming soon). The current version supports single-location management."
                        }
                    ].map((faq, index) => (
                        <div key={index} className={`faq-item ${openFaqIndex === index ? 'open' : ''}`}>
                            <div className="faq-question" onClick={() => toggleFaq(index)}>
                                <span>{faq.question}</span>
                                <svg className="faq-icon w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                            {openFaqIndex === index && (
                                <div className="faq-answer">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <section className="landing-section text-center" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)' }}>
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">
                        Ready to Transform Your Tuition Business?
                    </h2>
                    <p className="text-xl mb-8" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Join us today and experience the future of tuition centre management
                    </p>
                    <Link href="/signup" className="btn-primary-landing">
                        Get Started for Free
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-16 px-8" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div className="max-w-7xl mx-auto">
                    {/* Main Footer Content */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                        {/* Brand Column */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <span className="text-xl">🚀</span>
                                </div>
                                <span className="text-2xl font-bold">SprintScale</span>
                            </div>
                            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                Empowering tuition centres to streamline operations and scale their business with intelligent management tools.
                            </p>
                        </div>

                        {/* Product Column */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Product</h3>
                            <ul className="space-y-3">
                                <li>
                                    <a href="#features" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                        Features
                                    </a>
                                </li>
                                <li>
                                    <a href="#pricing" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                        Pricing
                                    </a>
                                </li>
                                <li>
                                    <Link href="/dashboard" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                        Dashboard
                                    </Link>
                                </li>
                                <li>
                                    <a href="#how-it-works" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                        How It Works
                                    </a>
                                </li>
                                <li>
                                    <a href="#faq" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                        FAQ
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* Contact Column */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Contact</h3>
                            <div className="space-y-3">
                                <a
                                    href="mailto:support@sprintscale.com"
                                    className="flex items-center gap-2 text-sm hover:text-white transition-colors"
                                    style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    support@sprintscale.com
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                            © 2026 SprintScale IT. All rights reserved.
                        </p>
                        <div className="flex gap-6">
                            <Link href="/privacy" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                                Privacy Policy
                            </Link>
                            <Link href="/terms" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                                Terms and Conditions
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
