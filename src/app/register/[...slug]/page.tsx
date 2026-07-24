'use client';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { RegistrationTemplate } from '@/features/registration/components/RegistrationTemplate';
import dynamic from 'next/dynamic';
import type { SignaturePadHandle } from '@/features/registration/components/SignaturePadWidget';

const SignaturePadWidget = dynamic(
    () => import('@/features/registration/components/SignaturePadWidget'),
    { ssr: false },
);

// ── Types ──────────────────────────────────────────────────────────
interface ChildEntry {
    childId?: string; // matched student identifier
    firstName: string; lastName: string; dateOfBirth: string; schoolYear: string;
    sessions: string[];
    allergies: string[];
    dietaryRequirements: string;
    medicalConditions: string;
    medicationNotes: string;
    gpName: string;
    gpPhone: string;
    senDetails: string;
    photoConsent: boolean;
    sunCreamConsent: boolean;
    firstAidConsent: boolean;
}
interface ParentEntry {
    parentId?: string; // matched parent identifier
    firstName: string; lastName: string; relationship: string;
    phone: string; email: string;
    addressLine1: string; addressLine2: string; city: string; postcode: string;
}
interface EmergencyContact { name: string; relationship: string; phone: string; }
// funding is now a single selection — `type` is the chosen option, `other` for free text
interface Funding { type: string; other: string; }
interface SpecialNeeds { has: boolean; details: string; }
interface AuthorisedCollector { name: string; relationship: string; phone: string; }

const YEAR_GROUPS = ['Reception', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'];
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Other'];
const FUNDING_OPTIONS = [
    { value: 'tax_free_childcare', label: 'Tax-Free Childcare' },
    { value: 'childcare_vouchers', label: 'Childcare Vouchers' },
    { value: 'universal_credit', label: 'Universal Credit' },
    { value: 'student_finance', label: 'Student Finance (CCG)' },
    { value: 'self_funded', label: 'Self-Funded' },
    { value: 'other', label: 'Other' },
];

const SESSION_SLOTS = [
    'Monday 4:30–5:50 pm', 'Monday 6:00–7:20 pm',
    'Tuesday 4:30–5:50 pm', 'Tuesday 6:00–7:20 pm',
    'Wednesday 4:30–5:50 pm', 'Wednesday 6:00–7:20 pm',
    'Thursday 4:30–5:50 pm', 'Thursday 6:00–7:20 pm',
    'Friday 4:30–5:50 pm', 'Friday 6:00–7:20 pm',
    'Saturday 10:00–11:20 am', 'Saturday 11:30–12:50 pm', 'Saturday 1:00–2:20 pm',
];
const emptyChild = (): ChildEntry => ({ 
    firstName: '', lastName: '', dateOfBirth: '', schoolYear: '', sessions: [],
    allergies: [], dietaryRequirements: '', medicalConditions: '', medicationNotes: '',
    gpName: '', gpPhone: '', senDetails: '', photoConsent: false, sunCreamConsent: false, firstAidConsent: false 
});
const emptyParent = (): ParentEntry => ({
    firstName: '', lastName: '', relationship: '', phone: '', email: '',
    addressLine1: '', addressLine2: '', city: '', postcode: '',
});

// ── Shared input styles ────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 min-h-[44px] rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50/40 focus:border-primary/50 text-base transition-colors';
const inputErrCls = 'w-full px-4 py-3 min-h-[44px] rounded-xl bg-card border border-destructive ring-2 ring-destructive/20 text-foreground placeholder:text-muted-foreground focus:outline-none text-base';
const labelCls = 'block text-sm font-medium text-muted-foreground mb-1';
const sectionTitle = 'text-foreground font-bold text-xl mb-5';

// ── Step indicator ─────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
    return (
        <div className="mb-8">
            <div className="flex gap-1.5 mb-2">
                {Array.from({ length: total }).map((_, i) => (
                    <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < current ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`} />
                ))}
            </div>
            <p className="text-muted-foreground text-xs text-center">Step {current} of {total}</p>
        </div>
    );
}

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode, htmlFor?: string }) {
    return <div><label htmlFor={htmlFor} className={labelCls}>{label}</label>{children}</div>;
}

export default function RegisterPage() {
    const params = useParams<{ slug: string[] }>();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';
    const [isPrefilled, setIsPrefilled] = useState(false);
    const orgSlug = params?.slug?.[0] || '';
    const centreSlugFromUrl = params?.slug?.[1];
    const [orgInfo, setOrgInfo] = useState<{
        name: string; logoUrl?: string; registrationTerms?: string; sessionSlots?: string[] | null; pricing?: { selfFinanceRate: number; taxCreditRate: number },
        centres?: { id: string; name: string; address: string | null; slug: string; operatingHours: string | null; sessionSlots: string | null; feeSelfFinance: string | null; feeAssistedFinance: string | null }[]
    } | null>(null);
    const [orgLoading, setOrgLoading] = useState(true);
    const [orgNotFound, setOrgNotFound] = useState(false);
    const [selectedCentreId, setSelectedCentreId] = useState<string | null>(null);
    const [showFeesIntro, setShowFeesIntro] = useState(true);
    const [step, setStep] = useState(1);
    const TOTAL_STEPS = 7;
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Form state
    const [startDate, setStartDate] = useState('');
    const [childList, setChildList] = useState<ChildEntry[]>([emptyChild()]);
    const [parentList, setParentList] = useState<ParentEntry[]>([emptyParent()]);
    const [secondParent, setSecondParent] = useState(false);
    const [emergency, setEmergency] = useState<EmergencyContact>({ name: '', relationship: '', phone: '' });
    const [authorisedCollectors, setAuthorisedCollectors] = useState<AuthorisedCollector[]>([]);
    const [funding, setFunding] = useState<Funding>({ type: '', other: '' });
    const [specialNeeds, setSpecialNeeds] = useState<SpecialNeeds>({ has: false, details: '' });
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const signaturePadRef = useRef<SignaturePadHandle>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [stepError, setStepError] = useState('');
    const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        setOrgLoading(true);
        setOrgNotFound(false);
        fetch(`/api/organisations/${orgSlug}/registration-info`)
            .then(r => {
                if (!r.ok) { setOrgNotFound(true); return null; }
                return r.json();
            })
            .then(data => {
                if (data) {
                    setOrgInfo(data);
                    if (data.centres && centreSlugFromUrl) {
                        const preselected = data.centres.find((c: any) => c.slug === centreSlugFromUrl);
                        if (preselected) setSelectedCentreId(preselected.id);
                    } else if (data.centres && data.centres.length === 1) {
                        setSelectedCentreId(data.centres[0].id);
                    }
                }
            })
            .catch(() => { setOrgNotFound(true); })
            .finally(() => setOrgLoading(false));
    }, [orgSlug, centreSlugFromUrl]);

    // Fetch pre-fill data if token is provided
    useEffect(() => {
        if (!token) return;
        fetch(`/api/register/prefill?token=${encodeURIComponent(token)}`)
            .then(r => {
                if (!r.ok) return null;
                return r.json();
            })
            .then(data => {
                if (data && data.success) {
                    setIsPrefilled(true);
                    if (data.centreId) setSelectedCentreId(data.centreId);
                    if (data.parents && data.parents.length > 0) {
                        setParentList(data.parents.map((p: any) => ({
                            parentId: data.parentId,
                            firstName: p.firstName,
                            lastName: p.lastName,
                            relationship: p.relationship,
                            phone: p.phone,
                            email: p.email,
                            addressLine1: p.addressLine1,
                            addressLine2: p.addressLine2,
                            city: p.city,
                            postcode: p.postcode,
                        })));
                    }
                    if (data.children && data.children.length > 0) {
                        setChildList(data.children.map((c: any) => ({
                            childId: c.childId,
                            firstName: c.firstName,
                            lastName: c.lastName,
                            dateOfBirth: c.dateOfBirth,
                            schoolYear: c.schoolYear,
                            sessions: c.sessions,
                        })));
                    }
                }
            })
            .catch(err => logger.error('[Prefill] Failed to load prefill details:', err));
    }, [token]);

    // ── Child helpers ──────────────────────────────────────────────
    const updateChild = (i: number, field: keyof ChildEntry, v: string | string[]) =>
        setChildList(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: v } : c));
    const addChild = () => setChildList(prev => [...prev, emptyChild()]);
    const removeChild = (i: number) => setChildList(prev => prev.filter((_, idx) => idx !== i));

    // ── Parent helpers ─────────────────────────────────────────────
    const updateParent = (i: number, field: keyof ParentEntry, v: string) =>
        setParentList(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: v } : p));

    useEffect(() => {
        if (secondParent && parentList.length < 2) setParentList(p => [...p, emptyParent()]);
        if (!secondParent && parentList.length > 1) setParentList(p => [p[0]]);
    }, [secondParent, parentList.length]);

    // ── Reset to start ─────────────────────────────────────────────
    const resetToStart = () => {
        setShowFeesIntro(true);
        if (orgInfo?.centres && orgInfo.centres.length > 1) {
            setSelectedCentreId(null);
        }
        setStep(1);
        setChildList([emptyChild()]);
        setParentList([emptyParent()]);
        setAuthorisedCollectors([]);
        setStartDate('');
        setError('');
    };

    // ── Step Validation ────────────────────────────────────────────
    const validateStep = (s: number): boolean => {
        const invalid = new Set<string>();
        let errorMsg = '';

        if (s === 1) {
            childList.forEach((c, i) => {
                if (!c.firstName.trim()) invalid.add(`child-fn-${i}`);
                if (!c.lastName.trim()) invalid.add(`child-ln-${i}`);
                if (!c.dateOfBirth) invalid.add(`child-dob-${i}`);
                if (!c.schoolYear) invalid.add(`child-yr-${i}`);
                if (c.sessions.length === 0) invalid.add(`child-sessions-${i}`);
            });
            if (invalid.size > 0) errorMsg = 'Please fill in all required child details (name, date of birth, and year group).';
        }

        if (s === 2) {
            // Only primary parent (index 0) is fully required
            const p = parentList[0];
            if (!p.firstName.trim()) invalid.add('p-fn-0');
            if (!p.lastName.trim()) invalid.add('p-ln-0');
            if (!p.relationship) invalid.add('p-rel-0');
            if (!p.phone.trim()) invalid.add('p-ph-0');
            if (!p.email.trim()) invalid.add('p-em-0');
            if (!p.addressLine1.trim()) invalid.add('p-a1-0');
            if (!p.city.trim()) invalid.add('p-city-0');
            if (!p.postcode.trim()) invalid.add('p-pc-0');
            // Second parent — only name and phone required if added
            if (parentList.length > 1) {
                const p2 = parentList[1];
                if (!p2.firstName.trim()) invalid.add('p-fn-1');
                if (!p2.lastName.trim()) invalid.add('p-ln-1');
                if (!p2.phone.trim()) invalid.add('p-ph-1');
            }
            if (invalid.size > 0) errorMsg = 'Please complete all required parent / carer details.';
        }

        if (s === 3) {
            if (!emergency.name.trim()) invalid.add('ec-name');
            if (!emergency.relationship.trim()) invalid.add('ec-rel');
            if (!emergency.phone.trim()) invalid.add('ec-phone');
            if (invalid.size > 0) errorMsg = 'Please provide emergency contact name, relationship, and phone number.';
        }

        if (s === 4) {
            if (!funding.type) {
                invalid.add('funding-group');
                errorMsg = 'Please select a funding method.';
            } else if (funding.type === 'other' && !funding.other.trim()) {
                invalid.add('fund-other');
                errorMsg = 'Please describe your funding method.';
            }
        }

        if (s === 5) {
            if (specialNeeds.has && !specialNeeds.details.trim()) {
                invalid.add('sn-details');
                errorMsg = 'Please provide details about your child\'s special educational needs.';
            }
        }

        if (s === 6) {
            authorisedCollectors.forEach((c, i) => {
                if (!c.name.trim()) invalid.add(`ac-name-${i}`);
                if (!c.relationship.trim()) invalid.add(`ac-rel-${i}`);
                if (!c.phone.trim()) invalid.add(`ac-ph-${i}`);
            });
            if (invalid.size > 0) errorMsg = 'Please provide name, relationship, and phone for all authorised collectors.';
        }

        if (s === 7) {
            if (!signature || signaturePadRef.current?.isEmpty()) {
                invalid.add('signature-pad');
                errorMsg = 'Please sign the form before submitting.';
            }
            if (!termsAgreed) {
                invalid.add('terms-agree');
                if (!errorMsg) errorMsg = 'You must agree to the Terms and Conditions.';
            }
        }

        setInvalidFields(invalid);
        setStepError(errorMsg);
        return invalid.size === 0;
    };

    const handleContinue = () => {
        if (validateStep(step)) {
            setStepError('');
            setInvalidFields(new Set());
            setStep(s => s + 1);
        }
    };

    // ── Submit ─────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validateStep(6)) return;
        setSubmitting(true); setError('');
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgSlug,
                    prefillToken: token || null,
                    centreId: selectedCentreId,
                    startDate: startDate ? new Date(startDate).toISOString() : null,
                    children: childList,
                    parents: parentList,
                    emergencyContact: emergency,
                    authorisedCollectors,
                    // send as types array for API compatibility (single item)
                    funding: { types: funding.type ? [funding.type] : [], other: funding.other },
                    specialNeeds,
                    termsAgreed,
                    parentSignature: signature,
                }),
            });
            if (res.status === 409) {
                const d = await res.json();
                setError(d.error || 'A registration already exists for this child. Please contact the centre.');
                setSubmitting(false);
                return;
            }
            if (!res.ok) {
                const d = await res.json();
                // If validation failed, surface the specific field errors to help debug
                if (d.details) {
                    const fieldList = Object.entries(d.details)
                        .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
                        .join(' | ');
                    throw new Error(`${d.error}: ${fieldList}`);
                }
                throw new Error(d.error || 'Submission failed');
            }
            setSubmitted(true);
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };


    // ── Loading screen ─────────────────────────────────────────────
    if (orgLoading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <svg className="w-8 h-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-muted-foreground text-sm">Loading registration form...</p>
                </div>
            </div>
        );
    }

    // ── Not found screen ───────────────────────────────────────────
    if (orgNotFound) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-3">Registration Link Not Found</h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        This registration link is invalid or no longer active.<br />
                        Please contact the organisation directly for a valid link.
                    </p>
                </div>
            </div>
        );
    }

    // ── Centre Selection Screen (if multiple centres) ──────────────────
    if (!selectedCentreId && orgInfo?.centres && orgInfo.centres.length > 1) {
        return (
            <div className="min-h-screen bg-background text-foreground">
                <div className="bg-card border-b border-border px-6 py-4">
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                        {orgInfo?.logoUrl && <img src={orgInfo.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                        <button onClick={resetToStart} className="text-left group cursor-pointer">
                            <p className="text-foreground font-semibold text-sm group-hover:text-primary transition-colors">{orgInfo?.name}</p>
                            <p className="text-muted-foreground text-xs">Student Registration Form</p>
                        </button>
                    </div>
                </div>
                <div className="max-w-md mx-auto px-4 py-16">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Select a Centre</h1>
                        <p className="text-muted-foreground text-sm">Choose the location where you would like to register your child.</p>
                    </div>
                    <div className="space-y-3">
                        {orgInfo.centres.map(centre => (
                            <button
                                key={centre.id}
                                onClick={() => setSelectedCentreId(centre.id)}
                                className="w-full text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/20 hover:shadow-md transition-all group"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-foreground font-semibold mb-0.5">{centre.name}</p>
                                        <p className="text-muted-foreground text-sm">{centre.address || 'After School provisions'}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary/90 transition-colors flex-shrink-0">
                                        <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-8 flex justify-start">
                        <Link href="/" className="px-6 py-3 rounded-xl border border-border text-muted-foreground hover:border-border hover:text-foreground transition-colors text-sm">
                            ← Back
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── Fees intro screen ──────────────────────────────────────────
    if (showFeesIntro) {
        const activeCentre = orgInfo?.centres?.find(c => c.id === selectedCentreId);
        
        return (
            <div className="min-h-screen bg-background text-foreground">
                {/* Header */}
                <div className="bg-card border-b border-border px-6 py-4">
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                        {orgInfo?.logoUrl && <img src={orgInfo.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                        <button onClick={resetToStart} className="text-left group cursor-pointer">
                            <p className="text-foreground font-semibold text-sm group-hover:text-primary transition-colors">{orgInfo?.name}</p>
                            <p className="text-muted-foreground text-xs">Student Registration Form</p>
                        </button>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto px-4 py-10">
                    {/* Title */}
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-primary text-xs font-medium">Please read before registering</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">📋 Fees &amp; Payment Information</h1>
                        <p className="text-muted-foreground text-sm">Before you complete the registration form, please review our fees and payment terms.</p>
                    </div>

                    {/* Mode of Finance card */}
                    <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-6 mb-5">
                        <p className="text-foreground/70 text-xs uppercase tracking-widest mb-3">Mode of Finance</p>
                        <div className="space-y-3">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-0">
                                <span className="text-foreground/80 text-sm">Self Finance</span>
                                <span className="text-foreground font-bold text-xl">£{activeCentre?.feeSelfFinance ?? orgInfo?.pricing?.selfFinanceRate ?? 20} <span className="text-foreground/60 font-normal text-sm">per session</span></span>
                            </div>
                            <div className="border-t border-white/20" />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-0">
                                <span className="text-foreground/80 text-sm">Tax Credit / Universal Credit / Student Finance</span>
                                <span className="text-foreground font-bold text-xl">£{activeCentre?.feeAssistedFinance ?? orgInfo?.pricing?.taxCreditRate ?? 30} <span className="text-foreground/60 font-normal text-sm">per session</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Payment terms */}
                    <div className="bg-card border border-border rounded-2xl p-6 mb-4">
                        <h2 className="text-foreground font-semibold text-sm mb-4">💳 Payment Terms</h2>
                        <div className="space-y-4">
                            {[
                                { icon: '📅', text: 'All fees must be paid 1 month in advance.' },
                                { icon: '⚠️', text: 'Fees are payable for all booked sessions, even if your child is absent, unless alternative arrangements have been agreed in advance with the manager.' },
                                { icon: '🔄', text: 'If your child misses a session, please contact the manager to request a catch-up session.' },
                                { icon: '🚫', text: "Persistent late or non-payment of fees may result in suspension or termination of your child's place at the club." },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-3">
                                    <span className="text-lg leading-tight">{item.icon}</span>
                                    <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Funding options */}
                    <div className="bg-card border border-border rounded-2xl p-6 mb-4">
                        <h2 className="text-foreground font-semibold text-sm mb-4">💰 Accepted Funding Methods</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { label: 'Tax-Free Childcare', desc: 'Via HMRC childcare account' },
                                { label: 'Universal Credit', desc: 'Childcare element — notify DWP of any changes' },
                                { label: 'Student Finance (CCG)', desc: 'Monthly requests submitted by the club' },
                                { label: 'Self-Funding', desc: 'Direct payment to the club' },
                            ].map((f, i) => (
                                <div key={i} className="bg-secondary rounded-xl p-4 border border-border">
                                    <p className="text-foreground text-sm font-semibold">{f.label}</p>
                                    <p className="text-muted-foreground text-xs mt-0.5">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Safeguarding note */}
                    <div className="bg-secondary border border-border rounded-2xl p-5 mb-8">
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            🔒 All personal information provided on this form is handled securely and confidentially.
                            Information may be shared with relevant authorities if required under safeguarding or child protection procedures.
                        </p>
                    </div>

                    {/* CTA */}
                    <div className="flex justify-between items-center mt-8 gap-4">
                        {orgInfo?.centres && orgInfo.centres.length > 1 ? (
                            <button onClick={() => setSelectedCentreId(null)} className="px-6 py-3 rounded-xl border border-border text-muted-foreground hover:border-border hover:text-foreground transition-colors text-sm whitespace-nowrap">
                                ← Back
                            </button>
                        ) : (
                            <Link href="/" className="px-6 py-3 rounded-xl border border-border text-muted-foreground hover:border-border hover:text-foreground transition-colors text-sm whitespace-nowrap">
                                ← Back
                            </Link>
                        )}
                        <button
                            onClick={() => setShowFeesIntro(false)}
                            className="flex-1 py-4 rounded-2xl font-semibold text-foreground text-base transition-all bg-primary text-primary-foreground hover:bg-primary/90 text-primary-foreground active:bg-primary/80 text-primary-foreground shadow-lg shadow-blue-600/25"
                        >
                            I understand — Proceed to Registration →
                        </button>
                    </div>
                    <p className="text-center text-muted-foreground text-xs mt-3">You will be asked to confirm your agreement to these terms at the end of the form.</p>
                </div>
            </div>
        );
    }

    // ── Success screen ─────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-success/10 border border-success/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-foreground mb-3">Registration Submitted!</h2>
                    <p className="text-muted-foreground mb-4">Thank you for registering with <strong className="text-foreground">{orgInfo?.name}</strong>.</p>
                    <p className="text-muted-foreground text-sm mb-6">A confirmation copy has been sent to your email. The team will be in touch to confirm your place.</p>
                    {isClient && (
                        <div className="flex flex-col gap-3">
                            <PDFDownloadLink
                                document={
                                    <RegistrationTemplate
                                        orgName={orgInfo?.name || 'SprintScale'}
                                        centreName={orgInfo?.centres?.find(c => c.id === selectedCentreId)?.name || null}
                                        startDate={startDate}
                                        parents={parentList.map(p => ({
                                            firstName: p.firstName,
                                            lastName: p.lastName,
                                            relationship: p.relationship || 'Parent',
                                            phone: p.phone,
                                            email: p.email,
                                            addressLine1: p.addressLine1,
                                            addressLine2: p.addressLine2,
                                            city: p.city,
                                            postcode: p.postcode,
                                        }))}
                                        registeredChildren={childList.map(c => ({
                                            firstName: c.firstName,
                                            lastName: c.lastName,
                                            dateOfBirth: c.dateOfBirth,
                                            schoolYear: c.schoolYear,
                                            sessions: c.sessions,
                                        }))}
                                        emergencyContact={emergency}
                                        funding={funding}
                                        specialNeeds={specialNeeds}
                                    />
                                }
                                fileName={`registration-${parentList[0]?.lastName.toLowerCase()}-${parentList[0]?.firstName.toLowerCase()}.pdf`.replace(/\s+/g, '-')}
                                className="w-full py-4 bg-primary text-primary-foreground hover:bg-primary/90 text-primary-foreground active:bg-primary/80 text-primary-foreground text-foreground font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/25"
                            >
                                {({ loading }) => (
                                    <>
                                        <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        {loading ? 'Preparing PDF...' : 'Download PDF Copy'}
                                    </>
                                )}
                            </PDFDownloadLink>
                            <button
                                onClick={resetToStart}
                                className="w-full py-3 bg-card hover:bg-secondary text-muted-foreground hover:text-foreground rounded-xl transition-all border border-border text-sm font-medium"
                            >
                                Register Another Child
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="bg-card border-b border-border px-6 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {orgInfo?.logoUrl && <img src={orgInfo.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                        <button onClick={resetToStart} className="text-left group cursor-pointer flex flex-col justify-center">
                            <p className="text-foreground font-semibold text-sm group-hover:text-primary transition-colors leading-tight">{orgInfo?.name ?? '...'}</p>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-0.5">{orgInfo?.centres?.find(c => c.id === selectedCentreId)?.name ?? 'Student Registration Form'}</p>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-10 pb-16">
                <ProgressBar current={step} total={TOTAL_STEPS} />

                {isPrefilled && (
                    <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            {childList.length > 1 ? (
                                <>
                                    <p className="text-sm font-bold text-primary">
                                        Registration pre-filled for {childList.length} children
                                    </p>
                                    <p className="text-xs text-primary font-semibold mt-0.5">
                                        This link covers: {childList.map(c => `${c.firstName} ${c.lastName}`.trim()).filter(Boolean).join(', ')}.
                                        Parent and shared details have been pre-filled — please review and complete any remaining fields.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-bold text-primary">Registration details pre-filled</p>
                                    <p className="text-xs text-primary font-semibold mt-0.5">We have pre-filled parent and student details from your assessment booking. Please review them and fill in any remaining fields.</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ── STEP 1: Children ───────────────────────────────────── */}
                {step === 1 && (
                    <div>
                        <h2 className={sectionTitle}>Children&apos;s Details</h2>
                        <div className="mb-6">
                            <Field label="Requested Start Date">
                                <input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                            </Field>
                        </div>
                        {childList.map((c, i) => (
                            <div key={i} className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-foreground font-semibold">Child {i + 1}</h3>
                                    {i > 0 && (
                                        <button onClick={() => removeChild(i)} className="text-destructive text-xs hover:text-destructive font-medium">Remove</button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <Field label="First Name *">
                                        <input id={`child-fn-${i}`} type="text" value={c.firstName} onChange={e => { updateChild(i, 'firstName', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`child-fn-${i}`); return n; }); }} className={invalidFields.has(`child-fn-${i}`) ? inputErrCls : inputCls} placeholder="First name" />
                                    </Field>
                                    <Field label="Last Name *">
                                        <input id={`child-ln-${i}`} type="text" value={c.lastName} onChange={e => { updateChild(i, 'lastName', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`child-ln-${i}`); return n; }); }} className={invalidFields.has(`child-ln-${i}`) ? inputErrCls : inputCls} placeholder="Last name" />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                    <Field label="Date of Birth *">
                                        <input id={`child-dob-${i}`} type="date" value={c.dateOfBirth} onChange={e => { updateChild(i, 'dateOfBirth', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`child-dob-${i}`); return n; }); }} className={invalidFields.has(`child-dob-${i}`) ? inputErrCls : inputCls} />
                                    </Field>
                                    <Field label="Year Group *">
                                        <select id={`child-yr-${i}`} value={c.schoolYear} onChange={e => { updateChild(i, 'schoolYear', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`child-yr-${i}`); return n; }); }} className={invalidFields.has(`child-yr-${i}`) ? inputErrCls : inputCls}>
                                            <option value="">Select year</option>
                                            {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </Field>
                                </div>
                                {/* Session times */}
                                <div className="border-t border-border pt-5">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <p className="text-foreground font-semibold text-sm">Select Preferred Sessions — Child {i + 1} *</p>
                                            <p className="text-muted-foreground text-xs mt-0.5">Please select the number of sessions required for your chosen days</p>
                                        </div>
                                    </div>
                                    <p className="text-warning text-xs mb-4">⚠ Session times selected can be changed by mutual agreement with the centre and yourself at any time.</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(() => {
                                            const activeCentre = orgInfo?.centres?.find(c => c.id === selectedCentreId);
                                            let slotsToUse = orgInfo?.sessionSlots ?? SESSION_SLOTS;
                                            if (activeCentre?.sessionSlots) {
                                                try { slotsToUse = JSON.parse(activeCentre.sessionSlots); } catch { /* ignore */ }
                                            }
                                            return slotsToUse.map((slot: string) => (
                                                <label key={slot} className="flex items-center gap-2.5 cursor-pointer group bg-secondary border border-border p-3 rounded-xl hover:border-primary/20 hover:bg-primary/10/50 transition-all">
                                                    <input
                                                        type="checkbox"
                                                        id={`child-${i}-session-${slot}`}
                                                        checked={c.sessions.includes(slot)}
                                                        onChange={e => {
                                                            const updated = e.target.checked
                                                                ? [...c.sessions, slot]
                                                                : c.sessions.filter(s => s !== slot);
                                                            updateChild(i, 'sessions', updated);
                                                        }}
                                                        className="w-4 h-4 rounded border-border accent-blue-600 cursor-pointer flex-shrink-0"
                                                    />
                                                    <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors break-words w-full">{slot}</span>
                                                </label>
                                            ));
                                        })()}
                                    </div>
                                </div>
                                {/* ── Medical & Consents ───────────────────────────────────── */}
                                <div className="border-t border-border mt-5 pt-5">
                                    <h4 className="text-foreground font-semibold text-sm mb-4">Medical &amp; Safeguarding Information</h4>
                                    
                                    <div className="space-y-4">
                                        <Field label="Dietary Requirements">
                                            <input type="text" value={c.dietaryRequirements} onChange={e => updateChild(i, 'dietaryRequirements', e.target.value)} className={inputCls} placeholder="e.g. Vegetarian, Halal, None" />
                                        </Field>
                                        
                                        <Field label="Medical Conditions">
                                            <input type="text" value={c.medicalConditions} onChange={e => updateChild(i, 'medicalConditions', e.target.value)} className={inputCls} placeholder="e.g. Asthma, Diabetes, None" />
                                        </Field>

                                        <Field label="Allergies (comma separated)">
                                            <input type="text" value={c.allergies.join(', ')} onChange={e => updateChild(i, 'allergies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className={inputCls} placeholder="e.g. Peanuts, Dairy" />
                                        </Field>
                                        
                                        <Field label="GP Name (Optional)">
                                            <input type="text" value={c.gpName} onChange={e => updateChild(i, 'gpName', e.target.value)} className={inputCls} placeholder="Dr. Smith" />
                                        </Field>
                                        
                                        <Field label="GP Phone (Optional)">
                                            <input type="tel" value={c.gpPhone} onChange={e => updateChild(i, 'gpPhone', e.target.value)} className={inputCls} placeholder="020 8123 4567" />
                                        </Field>

                                        <div className="pt-2">
                                            <p className="text-sm font-medium text-muted-foreground mb-3">Consents</p>
                                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-card border border-border mb-2 hover:border-primary/20">
                                                <input type="checkbox" checked={c.photoConsent} onChange={e => updateChild(i, 'photoConsent', e.target.checked as any)} className="w-4 h-4 rounded accent-blue-600" />
                                                <span className="text-muted-foreground text-sm">I consent to photos/videos being taken for marketing purposes</span>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-card border border-border mb-2 hover:border-primary/20">
                                                <input type="checkbox" checked={c.sunCreamConsent} onChange={e => updateChild(i, 'sunCreamConsent', e.target.checked as any)} className="w-4 h-4 rounded accent-blue-600" />
                                                <span className="text-muted-foreground text-sm">I consent to the application of sun cream if required</span>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-card border border-border hover:border-primary/20">
                                                <input type="checkbox" checked={c.firstAidConsent} onChange={e => updateChild(i, 'firstAidConsent', e.target.checked as any)} className="w-4 h-4 rounded accent-blue-600" />
                                                <span className="text-muted-foreground text-sm">I consent to emergency first aid treatment</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {childList.length < 5 && (
                            <button onClick={addChild} className="w-full py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/20 hover:text-primary transition-colors text-sm font-medium">
                                + Add Another Child
                            </button>
                        )}
                    </div>
                )}

                {/* ── STEP 2: Parents ─────────────────────────────────────── */}
                {step === 2 && (
                    <div>
                        <h2 className={sectionTitle}>Parent / Carer Details</h2>
                        {parentList.map((p, i) => (
                            <div key={i} className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-sm">
                                <h3 className="text-foreground font-semibold mb-4">Parent / Carer {i + 1}{i === 0 ? ' (Primary)' : ''}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <Field label="First Name *">
                                        <input id={`p-fn-${i}`} type="text" value={p.firstName} onChange={e => { updateParent(i, 'firstName', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-fn-${i}`); return n; }); }} className={invalidFields.has(`p-fn-${i}`) ? inputErrCls : inputCls} placeholder="First name" />
                                    </Field>
                                    <Field label="Last Name *">
                                        <input id={`p-ln-${i}`} type="text" value={p.lastName} onChange={e => { updateParent(i, 'lastName', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-ln-${i}`); return n; }); }} className={invalidFields.has(`p-ln-${i}`) ? inputErrCls : inputCls} placeholder="Last name" />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <Field label="Relationship *">
                                        <select id={`p-rel-${i}`} value={p.relationship} onChange={e => { updateParent(i, 'relationship', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-rel-${i}`); return n; }); }} className={invalidFields.has(`p-rel-${i}`) ? inputErrCls : inputCls}>
                                            <option value="">Select</option>
                                            {RELATIONSHIPS.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Phone Number *">
                                        <input id={`p-ph-${i}`} type="tel" value={p.phone} onChange={e => { updateParent(i, 'phone', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-ph-${i}`); return n; }); }} className={invalidFields.has(`p-ph-${i}`) ? inputErrCls : inputCls} placeholder="07xxx xxxxxx" />
                                    </Field>
                                </div>
                                <div className="mb-4">
                                    <Field label="Email Address *">
                                        <input id={`p-em-${i}`} type="email" value={p.email} onChange={e => { updateParent(i, 'email', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-em-${i}`); return n; }); }} className={invalidFields.has(`p-em-${i}`) ? inputErrCls : inputCls} placeholder="email@example.com" />
                                    </Field>
                                </div>
                                <div className="mb-4">
                                    <Field label="Address Line 1 *">
                                        <input id={`p-a1-${i}`} type="text" value={p.addressLine1} onChange={e => { updateParent(i, 'addressLine1', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-a1-${i}`); return n; }); }} className={invalidFields.has(`p-a1-${i}`) ? inputErrCls : inputCls} placeholder="Street address" />
                                    </Field>
                                </div>
                                <div className="mb-4">
                                    <Field label="Address Line 2">
                                        <input id={`p-a2-${i}`} type="text" value={p.addressLine2} onChange={e => updateParent(i, 'addressLine2', e.target.value)} className={inputCls} placeholder="Flat, suite, etc. (optional)" />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="City *">
                                        <input id={`p-city-${i}`} type="text" value={p.city} onChange={e => { updateParent(i, 'city', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-city-${i}`); return n; }); }} className={invalidFields.has(`p-city-${i}`) ? inputErrCls : inputCls} placeholder="London" />
                                    </Field>
                                    <Field label="Postcode *">
                                        <input id={`p-pc-${i}`} type="text" value={p.postcode} onChange={e => { updateParent(i, 'postcode', e.target.value); setInvalidFields(f => { const n = new Set(f); n.delete(`p-pc-${i}`); return n; }); }} className={invalidFields.has(`p-pc-${i}`) ? inputErrCls : inputCls} placeholder="SE26 4AA" />
                                    </Field>
                                </div>
                            </div>
                        ))}
                        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors shadow-sm">
                            <input id="secondParent" type="checkbox" checked={secondParent} onChange={e => setSecondParent(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
                            <span className="text-muted-foreground text-sm">Add a second parent / carer</span>
                        </label>
                    </div>
                )}

                {/* ── STEP 3: Emergency Contact ───────────────────────────── */}
                {step === 3 && (
                    <div>
                        <h2 className={sectionTitle}>Emergency Contact</h2>
                        <p className="text-muted-foreground text-sm mb-6">This should be someone other than the parents listed above who we can contact in an emergency.</p>
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                            <Field label="Full Name *">
                                <input id="ec-name" type="text" value={emergency.name} onChange={e => { setEmergency(v => ({ ...v, name: e.target.value })); setInvalidFields(f => { const n = new Set(f); n.delete('ec-name'); return n; }); }} className={invalidFields.has('ec-name') ? inputErrCls : inputCls} placeholder="Full name" />
                            </Field>
                            <Field label="Relationship to Child *">
                                <input id="ec-rel" type="text" value={emergency.relationship} onChange={e => { setEmergency(v => ({ ...v, relationship: e.target.value })); setInvalidFields(f => { const n = new Set(f); n.delete('ec-rel'); return n; }); }} className={invalidFields.has('ec-rel') ? inputErrCls : inputCls} placeholder="e.g. Grandparent, Aunt" />
                            </Field>
                            <Field label="Contact Number *">
                                <input id="ec-phone" type="tel" value={emergency.phone} onChange={e => { setEmergency(v => ({ ...v, phone: e.target.value })); setInvalidFields(f => { const n = new Set(f); n.delete('ec-phone'); return n; }); }} className={invalidFields.has('ec-phone') ? inputErrCls : inputCls} placeholder="07xxx xxxxxx" />
                            </Field>
                        </div>
                    </div>
                )}

                {/* ── STEP 4: Funding — single choice ─────────────────────── */}
                {step === 4 && (
                    <div>
                        <h2 className={sectionTitle}>Funding Information</h2>
                        <p className="text-muted-foreground text-sm mb-6">All fees must be paid 1 month in advance. How will you be funding your child&apos;s place?</p>
                        <div className="space-y-3">
                            {FUNDING_OPTIONS.map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                        funding.type === opt.value
                                            ? 'border-primary/20 bg-primary/10 ring-1 ring-blue-500/30'
                                            : 'border-border bg-card hover:border-primary/20 hover:bg-primary/10/30 shadow-sm'
                                    }`}
                                >
                                    <input
                                        id={`fund-${opt.value}`}
                                        type="radio"
                                        name="funding"
                                        checked={funding.type === opt.value}
                                        onChange={() => setFunding(f => ({ ...f, type: opt.value }))}
                                        className="w-4 h-4 accent-blue-600"
                                    />
                                    <span className="text-foreground text-sm font-medium">{opt.label}</span>
                                </label>
                            ))}
                            {funding.type === 'other' && (
                                <div className="pl-2 pt-1">
                                    <Field label="Please specify">
                                        <input
                                            id="fund-other"
                                            type="text"
                                            value={funding.other}
                                            onChange={e => { setFunding(f => ({ ...f, other: e.target.value })); setInvalidFields(flds => { const n = new Set(flds); n.delete('fund-other'); return n; }); }}
                                            className={invalidFields.has('fund-other') ? inputErrCls : inputCls}
                                            placeholder="Describe your funding method"
                                        />
                                    </Field>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── STEP 5: Special Needs ───────────────────────────────── */}
                {step === 5 && (
                    <div>
                        <h2 className={sectionTitle}>About Your Child</h2>
                        <p className="text-muted-foreground text-sm mb-6">Please let us know of any special educational needs, medical conditions, or other information that may help us support your child.</p>
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                            <p className="text-muted-foreground text-sm font-medium mb-4">Does your child have any special needs or medical information we should know about?</p>
                            <div className="flex gap-4 mb-6">
                                {[{ v: false, l: 'No' }, { v: true, l: 'Yes' }].map(opt => (
                                    <label key={String(opt.v)} className={`flex items-center gap-2 px-5 py-3 rounded-xl border cursor-pointer transition-all font-medium text-sm ${
                                        specialNeeds.has === opt.v
                                            ? 'border-primary/20 bg-primary/10 text-blue-700 ring-1 ring-blue-500/30'
                                            : 'border-border text-muted-foreground hover:border-primary/20'
                                    }`}>
                                        <input type="radio" name="specialNeeds" checked={specialNeeds.has === opt.v} onChange={() => setSpecialNeeds(s => ({ ...s, has: opt.v }))} className="sr-only" />
                                        {opt.l}
                                    </label>
                                ))}
                            </div>
                            {specialNeeds.has && (
                                <Field label="Please provide details *">
                                    <textarea
                                        id="sn-details"
                                        value={specialNeeds.details}
                                        onChange={e => { setSpecialNeeds(s => ({ ...s, details: e.target.value })); setInvalidFields(f => { const n = new Set(f); n.delete('sn-details'); return n; }); }}
                                        className={`${invalidFields.has('sn-details') ? inputErrCls : inputCls} min-h-[120px] resize-none`}
                                        placeholder="Describe any relevant conditions, allergies, medications, or support needs..."
                                    />
                                </Field>
                            )}
                        </div>
                    </div>
                )}

                {/* ── STEP 6: Authorised Collectors ─────────────────────────── */}
                {step === 6 && (
                    <div>
                        <h2 className={sectionTitle}>Authorised Collectors</h2>
                        <p className="text-muted-foreground text-sm mb-6">Please list any individuals authorised to collect your child(ren) from the centre.</p>
                        
                        {authorisedCollectors.map((c, i) => (
                            <div key={i} className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-sm relative">
                                <button onClick={() => setAuthorisedCollectors(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 text-destructive text-xs hover:text-destructive font-medium">Remove</button>
                                <h3 className="text-foreground font-semibold mb-4">Collector {i + 1}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <Field label="Full Name *">
                                        <input id={`ac-name-${i}`} type="text" value={c.name} onChange={e => { const v = [...authorisedCollectors]; v[i].name = e.target.value; setAuthorisedCollectors(v); setInvalidFields(f => { const n = new Set(f); n.delete(`ac-name-${i}`); return n; }); }} className={invalidFields.has(`ac-name-${i}`) ? inputErrCls : inputCls} placeholder="Full name" />
                                    </Field>
                                    <Field label="Relationship to Child *">
                                        <input id={`ac-rel-${i}`} type="text" value={c.relationship} onChange={e => { const v = [...authorisedCollectors]; v[i].relationship = e.target.value; setAuthorisedCollectors(v); setInvalidFields(f => { const n = new Set(f); n.delete(`ac-rel-${i}`); return n; }); }} className={invalidFields.has(`ac-rel-${i}`) ? inputErrCls : inputCls} placeholder="e.g. Grandparent" />
                                    </Field>
                                </div>
                                <div className="mb-2">
                                    <Field label="Phone Number *">
                                        <input id={`ac-ph-${i}`} type="tel" value={c.phone} onChange={e => { const v = [...authorisedCollectors]; v[i].phone = e.target.value; setAuthorisedCollectors(v); setInvalidFields(f => { const n = new Set(f); n.delete(`ac-ph-${i}`); return n; }); }} className={invalidFields.has(`ac-ph-${i}`) ? inputErrCls : inputCls} placeholder="07xxx xxxxxx" />
                                    </Field>
                                </div>
                            </div>
                        ))}
                        
                        {authorisedCollectors.length < 3 && (
                            <button onClick={() => setAuthorisedCollectors(prev => [...prev, { name: '', relationship: '', phone: '' }])} className="w-full py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/20 hover:text-primary transition-colors text-sm font-medium">
                                + Add Authorised Collector
                            </button>
                        )}
                    </div>
                )}

                {/* ── STEP 7: Terms & Submit ──────────────────────────────── */}
                {step === 7 && (
                    <div>
                        <h2 className={sectionTitle}>Review &amp; Submit</h2>

                        {/* Summary */}
                        <div className="bg-card border border-border rounded-2xl p-5 mb-5 space-y-3 text-sm shadow-sm">
                            <div><span className="text-muted-foreground uppercase text-xs tracking-wide font-bold">Children</span>
                                {childList.map((c, i) => <p key={i} className="text-foreground mt-1 font-medium">{c.firstName} {c.lastName} · {c.schoolYear}</p>)}
                            </div>
                            <div><span className="text-muted-foreground uppercase text-xs tracking-wide font-bold">Primary Parent</span>
                                <p className="text-foreground mt-1">{parentList[0]?.firstName} {parentList[0]?.lastName} · {parentList[0]?.email}</p>
                            </div>
                            <div><span className="text-muted-foreground uppercase text-xs tracking-wide font-bold">Emergency Contact</span>
                                <p className="text-foreground mt-1">{emergency.name} ({emergency.relationship}) · {emergency.phone}</p>
                            </div>
                            {authorisedCollectors.length > 0 && (
                                <div><span className="text-muted-foreground uppercase text-xs tracking-wide font-bold">Authorised Collectors</span>
                                    {authorisedCollectors.map((c, i) => (
                                        <p key={i} className="text-foreground mt-1">{c.name} ({c.relationship}) · {c.phone}</p>
                                    ))}
                                </div>
                            )}
                            <div><span className="text-muted-foreground uppercase text-xs tracking-wide font-bold">Funding</span>
                                <p className="text-foreground mt-1">
                                    {FUNDING_OPTIONS.find(o => o.value === funding.type)?.label ?? 'Not specified'}
                                    {funding.type === 'other' && funding.other ? ` — ${funding.other}` : ''}
                                </p>
                            </div>
                            {startDate && <div><span className="text-muted-foreground uppercase text-xs tracking-wide font-bold">Start Date</span>
                                <p className="text-foreground mt-1">{new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>}
                        </div>

                        {/* T&Cs */}
                        {orgInfo?.registrationTerms && (
                            <div className="bg-card border border-border rounded-2xl p-5 mb-5 shadow-sm">
                                <h3 className="text-foreground font-semibold text-sm mb-3">Terms &amp; Conditions</h3>
                                <div className="text-muted-foreground text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap pr-2">
                                    {orgInfo.registrationTerms}
                                </div>
                            </div>
                        )}

                        <label className={`flex items-start gap-3 p-4 rounded-xl bg-card border cursor-pointer mb-5 hover:border-primary/20 transition-colors shadow-sm ${
                            invalidFields.has('terms-agree') ? 'border-destructive/20 ring-1 ring-red-400/30' : 'border-border'
                        }`}>
                            <input
                                id="terms-agree"
                                type="checkbox"
                                checked={termsAgreed}
                                onChange={e => { setTermsAgreed(e.target.checked); setInvalidFields(f => { const n = new Set(f); n.delete('terms-agree'); return n; }); }}
                                className="w-4 h-4 mt-0.5 rounded flex-shrink-0 accent-blue-600"
                            />
                            <span className="text-muted-foreground text-sm">I confirm that I have read and agree to the Terms and Conditions above, and that the information provided is accurate.</span>
                        </label>

                        {/* Signature */}
                        <div className="mb-5">
                            <p className="text-foreground font-semibold text-sm mb-1">Parent / Carer Signature <span className="text-destructive">*</span></p>
                            <p className="text-muted-foreground text-xs mb-3">By signing below you confirm that all information provided is accurate and that you agree to the terms above.</p>
                            <SignaturePadWidget
                                ref={signaturePadRef}
                                onChange={val => { setSignature(val); setInvalidFields(f => { const n = new Set(f); n.delete('signature-pad'); return n; }); }}
                                invalid={invalidFields.has('signature-pad')}
                            />
                            {invalidFields.has('signature-pad') && (
                                <p className="text-destructive text-xs mt-1.5">A signature is required to submit the form.</p>
                            )}
                        </div>

                        {error && <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm mb-4">{error}</div>}

                        <button
                            id="submit-registration"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full py-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-primary-foreground active:bg-primary/80 text-primary-foreground text-foreground font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
                        >
                            {submitting ? (
                                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Submitting...</>
                            ) : 'Submit Registration'}
                        </button>
                    </div>
                )}

                {/* ── Navigation ─────────────────────────────────────────── */}
                <div className="flex justify-between items-center mt-10 pb-4">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary transition-all text-sm font-medium"
                        >
                            ← Back
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowFeesIntro(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary transition-all text-sm font-medium"
                        >
                            ← Back
                        </button>
                    )}
                    {step < TOTAL_STEPS && (
                        <button
                            onClick={handleContinue}
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-primary-foreground active:bg-primary/80 text-primary-foreground text-foreground font-semibold transition-all text-sm shadow-md shadow-blue-600/25"
                        >
                            Continue →
                        </button>
                    )}
                </div>

                {/* Step-level error message */}
                {stepError && (
                    <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {stepError}
                    </div>
                )}
            </div>
        </div>
    );
}
