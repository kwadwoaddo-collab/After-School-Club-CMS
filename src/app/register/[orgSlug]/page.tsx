'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────
interface ChildEntry {
    firstName: string; lastName: string; dateOfBirth: string; schoolYear: string;
    sessions: string[];
}
interface ParentEntry {
    firstName: string; lastName: string; relationship: string;
    phone: string; email: string;
    addressLine1: string; addressLine2: string; city: string; postcode: string;
}
interface EmergencyContact { name: string; relationship: string; phone: string; }
// funding is now a single selection — `type` is the chosen option, `other` for free text
interface Funding { type: string; other: string; }
interface SpecialNeeds { has: boolean; details: string; }

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
const emptyChild = (): ChildEntry => ({ firstName: '', lastName: '', dateOfBirth: '', schoolYear: '', sessions: [] });
const emptyParent = (): ParentEntry => ({
    firstName: '', lastName: '', relationship: '', phone: '', email: '',
    addressLine1: '', addressLine2: '', city: '', postcode: '',
});

// ── Shared input styles ────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 min-h-[44px] rounded-lg bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
const labelCls = 'block text-sm font-medium text-white/70 mb-1';
const sectionTitle = 'text-white font-semibold text-lg mb-4';

// ── Step indicator ─────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
    return (
        <div className="mb-8">
            <div className="flex justify-between mb-2">
                {Array.from({ length: total }).map((_, i) => (
                    <div key={i} className={`flex-1 h-1.5 rounded-full mx-0.5 transition-all ${i < current ? 'bg-blue-500' : 'bg-white/10'}`} />
                ))}
            </div>
            <p className="text-white/40 text-xs text-center">Step {current} of {total}</p>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className={labelCls}>{label}</label>{children}</div>;
}

export default function RegisterPage() {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [orgInfo, setOrgInfo] = useState<{
        name: string; logoUrl?: string; registrationTerms?: string; sessionSlots?: string[] | null; pricing?: { selfFinanceRate: number; taxCreditRate: number },
        centres?: { id: string; name: string; address: string | null; slug: string; operatingHours: string | null; sessionSlots: string | null; feeSelfFinance: string | null; feeAssistedFinance: string | null }[]
    } | null>(null);
    const [orgLoading, setOrgLoading] = useState(true);
    const [orgNotFound, setOrgNotFound] = useState(false);
    const [selectedCentreId, setSelectedCentreId] = useState<string | null>(null);
    const [showFeesIntro, setShowFeesIntro] = useState(true);
    const [step, setStep] = useState(1);
    const TOTAL_STEPS = 6;

    // Form state
    const [startDate, setStartDate] = useState('');
    const [childList, setChildList] = useState<ChildEntry[]>([emptyChild()]);
    const [parentList, setParentList] = useState<ParentEntry[]>([emptyParent()]);
    const [secondParent, setSecondParent] = useState(false);
    const [emergency, setEmergency] = useState<EmergencyContact>({ name: '', relationship: '', phone: '' });
    const [funding, setFunding] = useState<Funding>({ type: '', other: '' });
    const [specialNeeds, setSpecialNeeds] = useState<SpecialNeeds>({ has: false, details: '' });
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

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
                    if (data.centres && data.centres.length === 1) {
                        setSelectedCentreId(data.centres[0].id);
                    }
                }
            })
            .catch(() => { setOrgNotFound(true); })
            .finally(() => setOrgLoading(false));
    }, [orgSlug]);

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
    }, [secondParent]);

    // ── Reset to start ─────────────────────────────────────────────
    const resetToStart = () => {
        setShowFeesIntro(true);
        if (orgInfo?.centres && orgInfo.centres.length > 1) {
            setSelectedCentreId(null);
        }
        setStep(1);
        setChildList([emptyChild()]);
        setParentList([emptyParent()]);
        setStartDate('');
        setError('');
    };

    // ── Submit ─────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!termsAgreed) { setError('You must agree to the Terms and Conditions.'); return; }
        setSubmitting(true); setError('');
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgSlug,
                    centreId: selectedCentreId,
                    startDate,
                    children: childList,
                    parents: parentList,
                    emergencyContact: emergency,
                    // send as types array for API compatibility (single item)
                    funding: { types: funding.type ? [funding.type] : [], other: funding.other },
                    specialNeeds,
                    termsAgreed,
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Submission failed'); }
            setSubmitted(true);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Loading screen ─────────────────────────────────────────────
    if (orgLoading) {
        return (
            <div className="min-h-screen sidebar-gradient">
                <div className="flex flex-col items-center gap-4">
                    <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-white/40 text-sm">Loading registration form...</p>
                </div>
            </div>
        );
    }

    // ── Not found screen ───────────────────────────────────────────
    if (orgNotFound) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 sidebar-gradient">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-500/10 border border-red-400/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">Registration Link Not Found</h1>
                    <p className="text-white/50 text-sm leading-relaxed">
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
            <div className="min-h-screen sidebar-gradient">
                <div className="bg-white/5 border-b border-white/10 px-6 py-4">
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                        {orgInfo?.logoUrl && <img src={orgInfo.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                        <button onClick={resetToStart} className="text-left group cursor-pointer">
                            <p className="text-white font-semibold text-sm group-hover:text-blue-300 transition-colors">{orgInfo?.name}</p>
                            <p className="text-white/40 text-xs group-hover:text-white/60 transition-colors">Student Registration Form</p>
                        </button>
                    </div>
                </div>
                <div className="max-w-md mx-auto px-4 py-16">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-500/10 border border-blue-400/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Select a Centre</h1>
                        <p className="text-white/50 text-sm">Choose the location where you would like to register your child.</p>
                    </div>
                    <div className="space-y-4">
                        {orgInfo.centres.map(centre => (
                            <button
                                key={centre.id}
                                onClick={() => setSelectedCentreId(centre.id)}
                                className="w-full text-left p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-400 hover:bg-white/10 transition-all group"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-white font-medium mb-1">{centre.name}</p>
                                        <p className="text-white/50 text-sm">{centre.address || 'After School provisions'}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:border-blue-400 transition-colors">
                                        <svg className="w-4 h-4 text-white/30 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-8 flex justify-start">
                        <Link href="/" className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:border-white/20 hover:text-white transition-colors text-sm">
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
            <div className="min-h-screen sidebar-gradient">
                {/* Header */}
                <div className="bg-white/5 border-b border-white/10 px-6 py-4">
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                        {orgInfo?.logoUrl && <img src={orgInfo.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                        <button onClick={resetToStart} className="text-left group cursor-pointer">
                            <p className="text-white font-semibold text-sm group-hover:text-blue-300 transition-colors">{orgInfo?.name}</p>
                            <p className="text-white/40 text-xs group-hover:text-white/60 transition-colors">Student Registration Form</p>
                        </button>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto px-4 py-10">
                    {/* Title */}
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 rounded-full px-4 py-1.5 mb-4">
                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-blue-400 text-xs font-medium">Please read before registering</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">📋 Fees &amp; Payment Information</h1>
                        <p className="text-white/50 text-sm">Before you complete the registration form, please review our fees and payment terms.</p>
                    </div>

                    {/* Mode of Finance card */}
                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-400/20 rounded-2xl p-6 mb-5">
                        <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Mode of Finance</p>
                        <div className="space-y-3">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-0">
                                <span className="text-white/70 text-sm">Self Finance</span>
                                <span className="text-white font-bold text-lg">£{activeCentre?.feeSelfFinance ?? orgInfo?.pricing?.selfFinanceRate ?? 20} <span className="text-white/50 font-normal text-sm">per session</span></span>
                            </div>
                            <div className="border-t border-white/10" />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-0">
                                <span className="text-white/70 text-sm">Tax Credit / Universal Credit / Student Finance</span>
                                <span className="text-white font-bold text-lg">£{activeCentre?.feeAssistedFinance ?? orgInfo?.pricing?.taxCreditRate ?? 30} <span className="text-white/50 font-normal text-sm">per session</span></span>
                            </div>
                        </div>

                    </div>

                    {/* Payment terms */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5 space-y-4">
                        <h2 className="text-white font-semibold text-sm mb-3">💳 Payment Terms</h2>
                        <div className="space-y-3">
                            {[
                                { icon: '📅', text: 'All fees must be paid 1 month in advance.' },
                                { icon: '⚠️', text: 'Fees are payable for all booked sessions, even if your child is absent, unless alternative arrangements have been agreed in advance with the manager.' },
                                { icon: '🔄', text: 'If your child misses a session, please contact the manager to request a catch-up session.' },
                                { icon: '🚫', text: "Persistent late or non-payment of fees may result in suspension or termination of your child's place at the club." },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-3">
                                    <span className="text-lg leading-tight">{item.icon}</span>
                                    <p className="text-white/60 text-sm leading-relaxed">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Funding options */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
                        <h2 className="text-white font-semibold text-sm mb-3">💰 Accepted Funding Methods</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Tax-Free Childcare', desc: 'Via HMRC childcare account' },
                                { label: 'Universal Credit', desc: 'Childcare element — notify DWP of any changes' },
                                { label: 'Student Finance (CCG)', desc: 'Monthly requests submitted by the club' },
                                { label: 'Self-Funding', desc: 'Direct payment to the club' },
                            ].map((f, i) => (
                                <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                    <p className="text-white text-sm font-medium">{f.label}</p>
                                    <p className="text-white/40 text-xs mt-0.5">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Safeguarding note */}
                    <div className="bg-white/3 border border-white/8 rounded-2xl p-5 mb-8">
                        <p className="text-white/40 text-xs leading-relaxed">
                            🔒 All personal information provided on this form is handled securely and confidentially.
                            Information may be shared with relevant authorities if required under safeguarding or child protection procedures.
                        </p>
                    </div>

                    {/* CTA */}
                    <div className="flex justify-between items-center mt-8 gap-4">
                        {orgInfo?.centres && orgInfo.centres.length > 1 ? (
                            <button onClick={() => setSelectedCentreId(null)} className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:border-white/20 hover:text-white transition-colors text-sm whitespace-nowrap">
                                ← Back
                            </button>
                        ) : (
                            <Link href="/" className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:border-white/20 hover:text-white transition-colors text-sm whitespace-nowrap">
                                ← Back
                            </Link>
                        )}
                        <button
                            onClick={() => setShowFeesIntro(false)}
                            className="flex-1 py-4 rounded-2xl font-semibold text-white text-base transition-all bg-primary glow-btn"
                        >
                            I understand — Proceed to Registration →
                        </button>
                    </div>
                    <p className="text-center text-white/30 text-xs mt-3">You will be asked to confirm your agreement to these terms at the end of the form.</p>
                </div>
            </div>
        );
    }

    // ── Success screen ─────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 sidebar-gradient">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-green-500/20 border border-green-400/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">Registration Submitted!</h2>
                    <p className="text-white/60 mb-2">Thank you for registering with <strong className="text-white">{orgInfo?.name}</strong>.</p>
                    <p className="text-white/40 text-sm">A confirmation copy has been sent to your email. The team will be in touch to confirm your place.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen sidebar-gradient">
            {/* Header */}
            <div className="bg-white/5 border-b border-white/10 px-6 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {orgInfo?.logoUrl && <img src={orgInfo.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                        <button onClick={resetToStart} className="text-left group cursor-pointer flex flex-col justify-center">
                            <p className="text-white font-semibold text-sm group-hover:text-blue-300 transition-colors leading-tight">{orgInfo?.name ?? '...'}</p>
                            <p className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">{orgInfo?.centres?.find(c => c.id === selectedCentreId)?.name ?? 'Student Registration Form'}</p>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-10">
                <ProgressBar current={step} total={TOTAL_STEPS} />

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
                            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-white font-medium">Child {i + 1}</h3>
                                    {i > 0 && (
                                        <button onClick={() => removeChild(i)} className="text-red-400 text-xs hover:text-red-300">Remove</button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <Field label="First Name *">
                                        <input id={`child-fn-${i}`} type="text" value={c.firstName} onChange={e => updateChild(i, 'firstName', e.target.value)} className={inputCls} placeholder="First name" required />
                                    </Field>
                                    <Field label="Last Name *">
                                        <input id={`child-ln-${i}`} type="text" value={c.lastName} onChange={e => updateChild(i, 'lastName', e.target.value)} className={inputCls} placeholder="Last name" required />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <Field label="Date of Birth *">
                                        <input id={`child-dob-${i}`} type="date" value={c.dateOfBirth} onChange={e => updateChild(i, 'dateOfBirth', e.target.value)} className={inputCls} required />
                                    </Field>
                                    <Field label="Year Group *">
                                        <select id={`child-yr-${i}`} value={c.schoolYear} onChange={e => updateChild(i, 'schoolYear', e.target.value)} className={inputCls} required>
                                            <option value="">Select year</option>
                                            {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </Field>
                                </div>
                                {/* Session times */}
                                <div className="border-t border-white/10 pt-5">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <p className="text-white font-medium text-sm">Select Preferred Sessions — Child {i + 1} *</p>
                                            <p className="text-white/40 text-xs mt-0.5">Please select the number of sessions required for your chosen days</p>
                                        </div>
                                    </div>
                                    <p className="text-amber-400/80 text-xs mb-4">⚠ Session times selected can be changed by mutual agreement with the centre and yourself at any time.</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(() => {
                                            const activeCentre = orgInfo?.centres?.find(c => c.id === selectedCentreId);
                                            let slotsToUse = orgInfo?.sessionSlots ?? SESSION_SLOTS;
                                            if (activeCentre?.sessionSlots) {
                                                try { slotsToUse = JSON.parse(activeCentre.sessionSlots); } catch { /* ignore */ }
                                            }
                                            return slotsToUse.map((slot: string) => (
                                                <label key={slot} className="flex items-center gap-2.5 cursor-pointer group bg-white/5 border border-white/10 p-3 rounded-lg hover:border-white/20 transition-all">
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
                                                        className="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-500 cursor-pointer"
                                                    />
                                                    <span className="text-white/80 text-xs group-hover:text-white transition-colors break-words w-full">{slot}</span>
                                                </label>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {childList.length < 5 && (
                            <button onClick={addChild} className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/50 hover:border-blue-400/50 hover:text-blue-400 transition-colors text-sm">
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
                            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
                                <h3 className="text-white font-medium mb-4">Parent / Carer {i + 1}{i === 0 ? ' (Primary)' : ''}</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <Field label="First Name *">
                                        <input id={`p-fn-${i}`} type="text" value={p.firstName} onChange={e => updateParent(i, 'firstName', e.target.value)} className={inputCls} placeholder="First name" />
                                    </Field>
                                    <Field label="Last Name *">
                                        <input id={`p-ln-${i}`} type="text" value={p.lastName} onChange={e => updateParent(i, 'lastName', e.target.value)} className={inputCls} placeholder="Last name" />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <Field label="Relationship *">
                                        <select id={`p-rel-${i}`} value={p.relationship} onChange={e => updateParent(i, 'relationship', e.target.value)} className={inputCls}>
                                            <option value="">Select</option>
                                            {RELATIONSHIPS.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Phone Number *">
                                        <input id={`p-ph-${i}`} type="tel" value={p.phone} onChange={e => updateParent(i, 'phone', e.target.value)} className={inputCls} placeholder="07xxx xxxxxx" />
                                    </Field>
                                </div>
                                <div className="mb-4">
                                    <Field label="Email Address *">
                                        <input id={`p-em-${i}`} type="email" value={p.email} onChange={e => updateParent(i, 'email', e.target.value)} className={inputCls} placeholder="email@example.com" />
                                    </Field>
                                </div>
                                <div className="mb-4">
                                    <Field label="Address Line 1 *">
                                        <input id={`p-a1-${i}`} type="text" value={p.addressLine1} onChange={e => updateParent(i, 'addressLine1', e.target.value)} className={inputCls} placeholder="Street address" />
                                    </Field>
                                </div>
                                <div className="mb-4">
                                    <Field label="Address Line 2">
                                        <input id={`p-a2-${i}`} type="text" value={p.addressLine2} onChange={e => updateParent(i, 'addressLine2', e.target.value)} className={inputCls} placeholder="Flat, suite, etc. (optional)" />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="City *">
                                        <input id={`p-city-${i}`} type="text" value={p.city} onChange={e => updateParent(i, 'city', e.target.value)} className={inputCls} placeholder="London" />
                                    </Field>
                                    <Field label="Postcode *">
                                        <input id={`p-pc-${i}`} type="text" value={p.postcode} onChange={e => updateParent(i, 'postcode', e.target.value)} className={inputCls} placeholder="SE26 4AA" />
                                    </Field>
                                </div>
                            </div>
                        ))}
                        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                            <input id="secondParent" type="checkbox" checked={secondParent} onChange={e => setSecondParent(e.target.checked)} className="w-4 h-4 rounded" />
                            <span className="text-white/70 text-sm">Add a second parent / carer</span>
                        </label>
                    </div>
                )}

                {/* ── STEP 3: Emergency Contact ───────────────────────────── */}
                {step === 3 && (
                    <div>
                        <h2 className={sectionTitle}>Emergency Contact</h2>
                        <p className="text-white/40 text-sm mb-6">This should be someone other than the parents listed above who we can contact in an emergency.</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                            <Field label="Full Name *">
                                <input id="ec-name" type="text" value={emergency.name} onChange={e => setEmergency(v => ({ ...v, name: e.target.value }))} className={inputCls} placeholder="Full name" />
                            </Field>
                            <Field label="Relationship to Child *">
                                <input id="ec-rel" type="text" value={emergency.relationship} onChange={e => setEmergency(v => ({ ...v, relationship: e.target.value }))} className={inputCls} placeholder="e.g. Grandparent, Aunt" />
                            </Field>
                            <Field label="Contact Number *">
                                <input id="ec-phone" type="tel" value={emergency.phone} onChange={e => setEmergency(v => ({ ...v, phone: e.target.value }))} className={inputCls} placeholder="07xxx xxxxxx" />
                            </Field>
                        </div>
                    </div>
                )}

                {/* ── STEP 4: Funding — single choice ─────────────────────── */}
                {step === 4 && (
                    <div>
                        <h2 className={sectionTitle}>Funding Information</h2>
                        <p className="text-white/40 text-sm mb-6">All fees must be paid 1 month in advance. How will you be funding your child&apos;s place?</p>
                        <div className="space-y-3">
                            {FUNDING_OPTIONS.map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${funding.type === opt.value
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <input
                                        id={`fund-${opt.value}`}
                                        type="radio"
                                        name="funding"
                                        checked={funding.type === opt.value}
                                        onChange={() => setFunding(f => ({ ...f, type: opt.value }))}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    <span className="text-white text-sm font-medium">{opt.label}</span>
                                </label>
                            ))}
                            {funding.type === 'other' && (
                                <div className="pl-2 pt-1">
                                    <Field label="Please specify">
                                        <input
                                            id="fund-other"
                                            type="text"
                                            value={funding.other}
                                            onChange={e => setFunding(f => ({ ...f, other: e.target.value }))}
                                            className={inputCls}
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
                        <p className="text-white/40 text-sm mb-6">Please let us know of any special educational needs, medical conditions, or other information that may help us support your child.</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <p className="text-white/70 text-sm font-medium mb-4">Does your child have any special needs or medical information we should know about?</p>
                            <div className="flex gap-4 mb-6">
                                {[{ v: false, l: 'No' }, { v: true, l: 'Yes' }].map(opt => (
                                    <label key={String(opt.v)} className={`flex items-center gap-2 px-5 py-3 rounded-xl border cursor-pointer transition-all ${specialNeeds.has === opt.v ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
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
                                        onChange={e => setSpecialNeeds(s => ({ ...s, details: e.target.value }))}
                                        className={`${inputCls} min-h-[120px] resize-none`}
                                        placeholder="Describe any relevant conditions, allergies, medications, or support needs..."
                                    />
                                </Field>
                            )}
                        </div>
                    </div>
                )}

                {/* ── STEP 6: Terms & Submit ──────────────────────────────── */}
                {step === 6 && (
                    <div>
                        <h2 className={sectionTitle}>Review &amp; Submit</h2>

                        {/* Summary */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 space-y-3 text-sm">
                            <div><span className="text-white/40 uppercase text-xs tracking-wide">Children</span>
                                {childList.map((c, i) => <p key={i} className="text-white mt-1">{c.firstName} {c.lastName} · {c.schoolYear}</p>)}
                            </div>
                            <div><span className="text-white/40 uppercase text-xs tracking-wide">Primary Parent</span>
                                <p className="text-white mt-1">{parentList[0]?.firstName} {parentList[0]?.lastName} · {parentList[0]?.email}</p>
                            </div>
                            <div><span className="text-white/40 uppercase text-xs tracking-wide">Emergency Contact</span>
                                <p className="text-white mt-1">{emergency.name} ({emergency.relationship}) · {emergency.phone}</p>
                            </div>
                            <div><span className="text-white/40 uppercase text-xs tracking-wide">Funding</span>
                                <p className="text-white mt-1">
                                    {FUNDING_OPTIONS.find(o => o.value === funding.type)?.label ?? 'Not specified'}
                                    {funding.type === 'other' && funding.other ? ` — ${funding.other}` : ''}
                                </p>
                            </div>
                            {startDate && <div><span className="text-white/40 uppercase text-xs tracking-wide">Start Date</span>
                                <p className="text-white mt-1">{new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>}
                        </div>

                        {/* T&Cs */}
                        {orgInfo?.registrationTerms && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
                                <h3 className="text-white font-medium text-sm mb-3">Terms &amp; Conditions</h3>
                                <div className="text-white/50 text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap pr-2">
                                    {orgInfo.registrationTerms}
                                </div>
                            </div>
                        )}

                        <label className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer mb-5 hover:border-white/20 transition-colors">
                            <input id="terms-agree" type="checkbox" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)} className="w-4 h-4 mt-0.5 rounded flex-shrink-0" />
                            <span className="text-white/70 text-sm">I confirm that I have read and agree to the Terms and Conditions above, and that the information provided is accurate.</span>
                        </label>

                        {error && <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm mb-4">{error}</div>}

                        <button
                            id="submit-registration"
                            onClick={handleSubmit}
                            disabled={submitting || !termsAgreed}
                            className="w-full py-4 rounded-xl bg-primary glow-btn text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Submitting...</>
                            ) : 'Submit Registration'}
                        </button>
                    </div>
                )}

                {/* ── Navigation ─────────────────────────────────────────── */}
                <div className="flex justify-between mt-8">
                    {step > 1 ? (
                        <button onClick={() => setStep(s => s - 1)} className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:border-white/20 hover:text-white transition-colors text-sm">
                            ← Back
                        </button>
                    ) : (
                        <button onClick={() => {
                            setShowFeesIntro(true);
                        }} className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:border-white/20 hover:text-white transition-colors text-sm">
                            ← Back
                        </button>
                    )}
                    {step < TOTAL_STEPS && (
                        <button onClick={() => setStep(s => s + 1)} className="px-6 py-3 rounded-xl bg-primary glow-btn text-white font-medium transition-colors text-sm">
                            Continue →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
