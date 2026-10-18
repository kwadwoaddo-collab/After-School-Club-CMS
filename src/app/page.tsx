'use client';

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import "./landing.css";

const CORPORATE_URL = "https://sprintscaleit.co.uk";
const CONTACT_URL = "https://sprintscaleit.co.uk/#contact";
const CONTACT_EMAIL = "contact@sprintscaleit.co.uk";

const iconProps = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
};

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
    {
        title: "Session & Class Scheduling",
        body: "Plan sessions and classes and keep your timetable in one place.",
        icon: (
            <svg {...iconProps}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
        ),
    },
    {
        title: "Student & Family Records",
        body: "Keep student details, parent and carer contacts, and registrations together.",
        icon: (
            <svg {...iconProps}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        ),
    },
    {
        title: "Billing & Family Statements",
        body: "Create invoices, record payments and review statements for each family.",
        icon: (
            <svg {...iconProps}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
        ),
    },
    {
        title: "Staff & Register Access",
        body: "Give staff the access they need to take registers and view their sessions.",
        icon: (
            <svg {...iconProps}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
];

const STEPS = [
    { title: "Create your account", body: "Sign up as an administrator and set up your organisation." },
    { title: "Set up your centre", body: "Add your centre, classes and sessions, and invite your team." },
    { title: "Add families", body: "Record students and their parents or carers, then start running sessions." },
];

const FAQS = [
    {
        question: "Who is the After-School Club CMS for?",
        answer: "It is built for after-school clubs, tuition centres and similar providers that need to manage sessions, student and family records, billing and staff access in one place.",
    },
    {
        question: "Is the CMS available to everyone?",
        answer: "The CMS is currently in early access. Pricing and plan terms are not published yet, so please get in touch with SprintScale IT to talk about your centre.",
    },
    {
        question: "How do staff sign in?",
        answer: "Invited staff can request a one-time sign-in link by email from the staff login page. Administrators sign in with their email and password or with Google.",
    },
    {
        question: "Can I manage more than one centre?",
        answer: "Ask us about your setup. Get in touch with SprintScale IT and we will talk through what you need.",
    },
    {
        question: "How do I get support or ask a question?",
        answer: `Email ${CONTACT_EMAIL} or use the contact form on the SprintScale IT website.`,
    },
];

function BrandLockup({ href, external = false }: { href: string; external?: boolean }) {
    const inner = (
        <>
            <span className="brand-chip" aria-hidden="true">S</span>
            <span className="brand-text">
                <span className="font-bold">After-School Club CMS</span>
                <small>by SprintScale IT</small>
            </span>
        </>
    );
    return external ? (
        <a href={href} className="brand-lockup" aria-label="After-School Club CMS · by SprintScale IT">{inner}</a>
    ) : (
        <Link href={href} className="brand-lockup" aria-label="After-School Club CMS · by SprintScale IT">{inner}</Link>
    );
}

export default function Home() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    useEffect(() => {
        document.body.classList.add('landing-page-active');
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.body.classList.remove('landing-page-active');
        };
    }, []);

    const toggleFaq = (index: number) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    return (
        <div className="landing-page">
            {/* Sticky Navbar */}
            <nav className={`landing-navbar ${isScrolled ? 'scrolled' : ''}`} aria-label="Main">
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <BrandLockup href="/" />
                    <div className="hidden md:flex items-center gap-4">
                        <a href="#features" className="landing-navbar-link">Features</a>
                        <a href="#how-it-works" className="landing-navbar-link">How It Works</a>
                        <a href="#early-access" className="landing-navbar-link">Early Access</a>
                        <a href="#faq" className="landing-navbar-link">FAQ</a>
                        <Link href="/login" className="landing-navbar-link">Log in</Link>
                        <Link href="/signup" className="btn-login">Get Started</Link>
                    </div>
                    <div className="md:hidden flex items-center gap-1">
                        <Link href="/login" className="landing-navbar-link">Log in</Link>
                        <Link href="/signup" className="btn-login">Get Started</Link>
                    </div>
                </div>
            </nav>

            <main>
                {/* Hero Section */}
                <section className="landing-section text-center" style={{ paddingTop: '6rem' }}>
                    <div className="max-w-4xl mx-auto">
                        <div className="eyebrow mb-6">
                            <span className="relative flex h-3 w-3" aria-hidden="true">
                                <span className="pulse-dot absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--if-accent)' }}></span>
                                <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--if-accent)' }}></span>
                            </span>
                            Early Access
                        </div>

                        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                            Run your after-school club
                            <br />
                            <span className="accent-text">from one workspace</span>
                        </h1>

                        <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto landing-muted">
                            Session scheduling, student and family records, billing and staff register access for after-school clubs and tuition centres.
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
                            <Link href="/signup" className="btn-primary-landing">Create an Account</Link>
                            <a href="#features" className="btn-outline-landing">Explore Features</a>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="landing-section" aria-labelledby="features-heading">
                    <div className="text-center mb-12">
                        <h2 id="features-heading" className="text-3xl md:text-4xl font-bold mb-4">What the CMS covers</h2>
                        <p className="text-lg landing-muted">The day-to-day work of running a club, in one place</p>
                    </div>

                    <div className="feature-grid">
                        {FEATURES.map((f) => (
                            <div key={f.title} className="feature-card">
                                <div className="feature-icon">{f.icon}</div>
                                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                                <p className="landing-muted">{f.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How It Works */}
                <section id="how-it-works" className="landing-section" aria-labelledby="how-heading">
                    <div className="text-center mb-12">
                        <h2 id="how-heading" className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
                        <p className="text-lg landing-muted">Getting started in three steps</p>
                    </div>

                    <div className="process-timeline">
                        {STEPS.map((s, i) => (
                            <div key={s.title} className="process-step">
                                <div className="process-number" aria-hidden="true">{i + 1}</div>
                                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                                <p className="landing-muted">{s.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Early Access / Enquiry */}
                <section id="early-access" className="landing-section" aria-labelledby="early-heading">
                    <div className="text-center mb-12">
                        <h2 id="early-heading" className="text-3xl md:text-4xl font-bold mb-4">Early Access</h2>
                        <p className="text-lg landing-muted">Pricing and plan terms are not published yet</p>
                    </div>

                    <div className="pricing-grid">
                        <div className="pricing-card active">
                            <h3 className="text-2xl font-bold mb-2">Early Access Workspace</h3>
                            <p className="landing-muted mb-6">
                                Create an administrator account and start setting up your centre.
                            </p>
                            <Link href="/signup" className="btn-primary-landing w-full text-center">Create an Account</Link>
                        </div>

                        <div className="pricing-card">
                            <h3 className="text-2xl font-bold mb-2">Enquire with SprintScale IT</h3>
                            <p className="landing-muted mb-6">
                                Talk to us about your centre and what you need from the CMS.
                            </p>
                            <a href={CONTACT_URL} className="btn-outline-landing w-full text-center">Contact SprintScale IT</a>
                        </div>
                    </div>
                </section>

                {/* Overview */}
                <section className="landing-section" aria-labelledby="overview-heading">
                    <div className="text-center mb-12">
                        <h2 id="overview-heading" className="text-3xl md:text-4xl font-bold mb-4">Built for Educational Providers</h2>
                    </div>

                    <div className="overview-card">
                        <p className="text-xl mb-6">
                            A dedicated platform for streamlining the administration of after-school clubs and tuition centres, from student registrations and session scheduling to registers and billing.
                        </p>
                        <p className="font-bold">After-School Club CMS</p>
                        <p className="landing-faint">by SprintScale IT</p>
                    </div>
                </section>

                {/* FAQ */}
                <section id="faq" className="landing-section" aria-labelledby="faq-heading">
                    <div className="text-center mb-12">
                        <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
                    </div>

                    <div className="max-w-3xl mx-auto">
                        {FAQS.map((faq, index) => {
                            const isOpen = openFaqIndex === index;
                            return (
                                <div key={faq.question} className={`faq-item ${isOpen ? 'open' : ''}`}>
                                    <h3>
                                        <button
                                            type="button"
                                            id={`faq-question-${index}`}
                                            className="faq-question"
                                            aria-expanded={isOpen}
                                            aria-controls={`faq-answer-${index}`}
                                            onClick={() => toggleFaq(index)}
                                        >
                                            <span>{faq.question}</span>
                                            <svg className="faq-icon w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </h3>
                                    {isOpen && (
                                        <div
                                            id={`faq-answer-${index}`}
                                            role="region"
                                            aria-labelledby={`faq-question-${index}`}
                                            className="faq-answer"
                                        >
                                            {faq.answer}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Final CTA */}
                <section className="landing-section">
                    <div className="cta-band text-center px-6 py-14">
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to set up your club?</h2>
                            <p className="text-lg mb-8 landing-muted">
                                Create an administrator account, or get in touch to talk it through first.
                            </p>
                            <Link href="/signup" className="btn-primary-landing">Create an Account</Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="landing-footer py-12 px-6 md:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
                        <div>
                            <div className="mb-4">
                                <BrandLockup href={CORPORATE_URL} external />
                            </div>
                            <p className="text-sm leading-relaxed landing-faint">
                                Administration tools for after-school clubs and tuition centres.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-3">Product</h3>
                            <ul>
                                <li><a href="#features" className="footer-link">Features</a></li>
                                <li><a href="#how-it-works" className="footer-link">How It Works</a></li>
                                <li><a href="#early-access" className="footer-link">Early Access</a></li>
                                <li><a href="#faq" className="footer-link">FAQ</a></li>
                                <li><Link href="/dashboard" className="footer-link">Dashboard</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-3">Contact</h3>
                            <ul>
                                <li>
                                    <a href={CONTACT_URL} className="footer-link">Contact SprintScale IT</a>
                                </li>
                                <li>
                                    <a href={`mailto:${CONTACT_EMAIL}`} className="footer-link">{CONTACT_EMAIL}</a>
                                </li>
                                <li>
                                    <a href={CORPORATE_URL} className="footer-link">sprintscaleit.co.uk</a>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-2" style={{ borderTop: '1px solid var(--if-border-subtle)' }}>
                        <p className="text-sm landing-faint">© 2026 SprintScale IT. All rights reserved.</p>
                        <div className="flex gap-4">
                            <Link href="/privacy" className="footer-link">Privacy Policy</Link>
                            <Link href="/terms" className="footer-link">Terms and Conditions</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
