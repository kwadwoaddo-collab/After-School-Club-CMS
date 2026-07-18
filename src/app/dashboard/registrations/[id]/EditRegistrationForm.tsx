'use client';

import { useState, useTransition } from 'react';
import { updateRegistrationDetails, UpdateRegistrationPayload } from '../actions';
import { Pencil, X, Save, Loader2, CheckCircle2 } from 'lucide-react';

const YEAR_GROUPS = ['Reception', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'];
const RELATIONSHIPS = ['mother', 'father', 'guardian', 'other'];
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

const input = 'w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm';
const label = 'text-xs text-white/50 uppercase tracking-wide mb-1 block';

interface RegParent {
    id: string;
    parentId: string | null;
    isPrimary: boolean | null;
    submittedFirstName: string;
    submittedLastName: string;
    submittedRelationship: string | null;
    submittedPhone: string | null;
    submittedEmail: string | null;
    parent?: {
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        postcode: string | null;
    } | null;
}

interface RegChild {
    id: string;
    childId: string | null;
    submittedFirstName: string;
    submittedLastName: string;
    submittedDateOfBirth: Date | null;
    submittedSchoolYear: string | null;
    submittedSessions: string[] | null;
}

interface Registration {
    id: string;
    startDate: Date | null;
    fundingTypes: string[] | null;
    fundingOther: string | null;
    emergencyContactName: string | null;
    emergencyContactRelationship: string | null;
    emergencyContactPhone: string | null;
    hasSpecialNeeds: boolean | null;
    specialNeedsDetails: string | null;
}

interface Props {
    reg: Registration;
    pars: RegParent[];
    kids: RegChild[];
    centreSessionSlots?: string[];
}

function formatDateForInput(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
}

export default function EditRegistrationForm({ reg, pars, kids, centreSessionSlots }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [startDate, setStartDate] = useState(formatDateForInput(reg.startDate));
    const [fundingType, setFundingType] = useState(reg.fundingTypes?.[0] || '');
    const [fundingOther, setFundingOther] = useState(reg.fundingOther || '');
    const [ecName, setEcName] = useState(reg.emergencyContactName || '');
    const [ecRel, setEcRel] = useState(reg.emergencyContactRelationship || '');
    const [ecPhone, setEcPhone] = useState(reg.emergencyContactPhone || '');
    const [hasSpecialNeeds, setHasSpecialNeeds] = useState(reg.hasSpecialNeeds ?? false);
    const [specialNeedsDetails, setSpecialNeedsDetails] = useState(reg.specialNeedsDetails || '');

    const [parentsState, setParentsState] = useState(
        pars.map(p => ({
            id: p.id,
            parentId: p.parentId,
            isPrimary: p.isPrimary,
            firstName: p.submittedFirstName,
            lastName: p.submittedLastName,
            relationship: p.submittedRelationship || '',
            phone: p.submittedPhone || '',
            email: p.submittedEmail || '',
            addressLine1: p.parent?.addressLine1 || '',
            addressLine2: p.parent?.addressLine2 || '',
            city: p.parent?.city || '',
            postcode: p.parent?.postcode || '',
        }))
    );

    const [childrenState, setChildrenState] = useState(
        kids.map(k => ({
            id: k.id,
            childId: k.childId,
            firstName: k.submittedFirstName,
            lastName: k.submittedLastName,
            dateOfBirth: formatDateForInput(k.submittedDateOfBirth),
            schoolYear: k.submittedSchoolYear || '',
            sessions: k.submittedSessions || [],
        }))
    );

    const updateParent = (idx: number, field: string, value: string) => {
        setParentsState(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    };

    const updateChild = (idx: number, field: string, value: string | string[]) => {
        setChildrenState(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    };

    const toggleChildSession = (childIdx: number, slot: string) => {
        setChildrenState(prev => prev.map((c, i) => {
            if (i !== childIdx) return c;
            const sessions = c.sessions.includes(slot)
                ? c.sessions.filter(s => s !== slot)
                : [...c.sessions, slot];
            return { ...c, sessions };
        }));
    };

    const handleCancel = () => {
        // Reset to original values
        setStartDate(formatDateForInput(reg.startDate));
        setFundingType(reg.fundingTypes?.[0] || '');
        setFundingOther(reg.fundingOther || '');
        setEcName(reg.emergencyContactName || '');
        setEcRel(reg.emergencyContactRelationship || '');
        setEcPhone(reg.emergencyContactPhone || '');
        setHasSpecialNeeds(reg.hasSpecialNeeds ?? false);
        setSpecialNeedsDetails(reg.specialNeedsDetails || '');
        setParentsState(pars.map(p => ({
            id: p.id,
            parentId: p.parentId,
            isPrimary: p.isPrimary,
            firstName: p.submittedFirstName,
            lastName: p.submittedLastName,
            relationship: p.submittedRelationship || '',
            phone: p.submittedPhone || '',
            email: p.submittedEmail || '',
            addressLine1: p.parent?.addressLine1 || '',
            addressLine2: p.parent?.addressLine2 || '',
            city: p.parent?.city || '',
            postcode: p.parent?.postcode || '',
        })));
        setChildrenState(kids.map(k => ({
            id: k.id,
            childId: k.childId,
            firstName: k.submittedFirstName,
            lastName: k.submittedLastName,
            dateOfBirth: formatDateForInput(k.submittedDateOfBirth),
            schoolYear: k.submittedSchoolYear || '',
            sessions: k.submittedSessions || [],
        })));
        setError('');
        setIsEditing(false);
    };

    const handleSave = () => {
        setError('');
        setSuccess(false);
        const payload: UpdateRegistrationPayload = {
            registrationId: reg.id,
            startDate,
            fundingType,
            fundingOther,
            emergencyContactName: ecName,
            emergencyContactRelationship: ecRel,
            emergencyContactPhone: ecPhone,
            hasSpecialNeeds,
            specialNeedsDetails,
            parentsData: parentsState,
            childrenData: childrenState,
        };
        startTransition(async () => {
            try {
                await updateRegistrationDetails(payload);
                setSuccess(true);
                setIsEditing(false);
                setTimeout(() => setSuccess(false), 3000);
            } catch (e: any) {
                setError(e.message || 'Failed to save changes');
            }
        });
    };

    const slots = centreSessionSlots || SESSION_SLOTS;

    if (!isEditing) {
        return (
            <div className="flex items-center gap-2">
                {success && (
                    <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Saved
                    </span>
                )}
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-card/5 hover:bg-card/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-medium rounded-xl text-sm transition-all"
                >
                    <Pencil className="w-4 h-4" />
                    Edit Details
                </button>
            </div>
        );
    }

    return (
        <div className="mt-6">
            {/* Edit mode banner */}
            <div className="flex items-center justify-between mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-primary" />
                    <span className="text-white font-medium text-sm">Editing Registration Details</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCancel}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 bg-card/5 hover:bg-card/10 transition-all"
                    >
                        <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 transition-all shadow-md shadow-primary/20"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Children */}
                <div className="md:col-span-2 glassmorphic-card rounded-2xl p-6">
                    <h2 className="text-white font-bold mb-4">Children</h2>
                    <div className="space-y-6">
                        {childrenState.map((c, i) => (
                            <div key={c.id} className="border border-white/5 rounded-xl p-4 bg-card/2">
                                <p className="text-white/50 text-xs uppercase tracking-wide mb-3">Child {i + 1}</p>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label htmlFor={`child-${c.id}-firstName`} className={label}>First Name</label>
                                        <input id={`child-${c.id}-firstName`} className={input} value={c.firstName} onChange={e => updateChild(i, 'firstName', e.target.value)} placeholder="First name" />
                                    </div>
                                    <div>
                                        <label htmlFor={`child-${c.id}-lastName`} className={label}>Last Name</label>
                                        <input id={`child-${c.id}-lastName`} className={input} value={c.lastName} onChange={e => updateChild(i, 'lastName', e.target.value)} placeholder="Last name" />
                                    </div>
                                    <div>
                                        <label htmlFor={`child-${c.id}-dob`} className={label}>Date of Birth</label>
                                        <input id={`child-${c.id}-dob`} type="date" className={input} value={c.dateOfBirth} onChange={e => updateChild(i, 'dateOfBirth', e.target.value)} />
                                    </div>
                                    <div>
                                        <label htmlFor={`child-${c.id}-year`} className={label}>Year Group</label>
                                        <select id={`child-${c.id}-year`} className={input} value={c.schoolYear} onChange={e => updateChild(i, 'schoolYear', e.target.value)}>
                                            <option value="">Select year</option>
                                            {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <p className={label}>Sessions</p>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        {slots.map(slot => (
                                            <label key={slot} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-all ${c.sessions.includes(slot) ? 'border-primary/50 bg-primary/10 text-white' : 'border-white/10 bg-card/3 text-white/50 hover:border-white/20'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={c.sessions.includes(slot)}
                                                    onChange={() => toggleChildSession(i, slot)}
                                                    className="w-3 h-3 accent-primary"
                                                />
                                                {slot}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parents */}
                {parentsState.map((p, i) => (
                    <div key={p.id} className="glassmorphic-card rounded-2xl p-6">
                        <h2 className="text-white font-bold mb-4">{p.isPrimary ? 'Primary ' : ''}Parent / Carer</h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor={`parent-${p.id}-firstName`} className={label}>First Name</label>
                                    <input id={`parent-${p.id}-firstName`} className={input} value={p.firstName} onChange={e => updateParent(i, 'firstName', e.target.value)} placeholder="First name" />
                                </div>
                                <div>
                                    <label htmlFor={`parent-${p.id}-lastName`} className={label}>Last Name</label>
                                    <input id={`parent-${p.id}-lastName`} className={input} value={p.lastName} onChange={e => updateParent(i, 'lastName', e.target.value)} placeholder="Last name" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor={`parent-${p.id}-relationship`} className={label}>Relationship</label>
                                    <select id={`parent-${p.id}-relationship`} className={input} value={p.relationship} onChange={e => updateParent(i, 'relationship', e.target.value)}>
                                        <option value="">Select</option>
                                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor={`parent-${p.id}-phone`} className={label}>Phone</label>
                                    <input id={`parent-${p.id}-phone`} className={input} value={p.phone} onChange={e => updateParent(i, 'phone', e.target.value)} placeholder="07xxx xxxxxx" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor={`parent-${p.id}-email`} className={label}>Email</label>
                                <input id={`parent-${p.id}-email`} type="email" className={input} value={p.email} onChange={e => updateParent(i, 'email', e.target.value)} placeholder="email@example.com" />
                            </div>
                            <div>
                                <label htmlFor={`parent-${p.id}-addr1`} className={label}>Address Line 1</label>
                                <input id={`parent-${p.id}-addr1`} className={input} value={p.addressLine1} onChange={e => updateParent(i, 'addressLine1', e.target.value)} placeholder="Street address" />
                            </div>
                            <div>
                                <label htmlFor={`parent-${p.id}-addr2`} className={label}>Address Line 2</label>
                                <input id={`parent-${p.id}-addr2`} className={input} value={p.addressLine2} onChange={e => updateParent(i, 'addressLine2', e.target.value)} placeholder="Flat / suite (optional)" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor={`parent-${p.id}-city`} className={label}>City</label>
                                    <input id={`parent-${p.id}-city`} className={input} value={p.city} onChange={e => updateParent(i, 'city', e.target.value)} placeholder="London" />
                                </div>
                                <div>
                                    <label htmlFor={`parent-${p.id}-postcode`} className={label}>Postcode</label>
                                    <input id={`parent-${p.id}-postcode`} className={input} value={p.postcode} onChange={e => updateParent(i, 'postcode', e.target.value)} placeholder="SE26 4AA" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Emergency Contact */}
                <div className="glassmorphic-card rounded-2xl p-6">
                    <h2 className="text-white font-bold mb-4">Emergency Contact</h2>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="ec-name" className={label}>Full Name</label>
                            <input id="ec-name" className={input} value={ecName} onChange={e => setEcName(e.target.value)} placeholder="Full name" />
                        </div>
                        <div>
                            <label htmlFor="ec-relationship" className={label}>Relationship</label>
                            <input id="ec-relationship" className={input} value={ecRel} onChange={e => setEcRel(e.target.value)} placeholder="e.g. Grandparent, Aunt" />
                        </div>
                        <div>
                            <label htmlFor="ec-phone" className={label}>Phone</label>
                            <input id="ec-phone" className={input} value={ecPhone} onChange={e => setEcPhone(e.target.value)} placeholder="07xxx xxxxxx" />
                        </div>
                    </div>
                </div>

                {/* Funding & Details */}
                <div className="glassmorphic-card rounded-2xl p-6">
                    <h2 className="text-white font-bold mb-4">Funding &amp; Details</h2>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="funding-start-date" className={label}>Requested Start Date</label>
                            <input id="funding-start-date" type="date" className={input} value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="funding-method" className={label}>Funding Method</label>
                            <select id="funding-method" className={input} value={fundingType} onChange={e => setFundingType(e.target.value)}>
                                <option value="">Select funding</option>
                                {FUNDING_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>
                        {fundingType === 'other' && (
                            <div>
                                <label htmlFor="funding-other" className={label}>Funding Details</label>
                                <input id="funding-other" className={input} value={fundingOther} onChange={e => setFundingOther(e.target.value)} placeholder="Describe your funding" />
                            </div>
                        )}
                        <div>
                            <p className={label}>Special Needs / Medical</p>
                            <div className="flex gap-3 mt-1 mb-2">
                                {[{ v: false, l: 'No' }, { v: true, l: 'Yes' }].map(opt => (
                                    <button
                                        key={String(opt.v)}
                                        type="button"
                                        onClick={() => setHasSpecialNeeds(opt.v)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${hasSpecialNeeds === opt.v ? 'border-primary bg-primary/10 text-white' : 'border-white/10 text-white/50 hover:border-white/20'}`}
                                    >
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                            {hasSpecialNeeds && (
                                <textarea
                                    id="special-needs-details"
                                    className={`${input} min-h-[80px] resize-none`}
                                    value={specialNeedsDetails}
                                    onChange={e => setSpecialNeedsDetails(e.target.value)}
                                    placeholder="Describe conditions, allergies, medications or support needs..."
                                />
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-white/10">
                <button
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 bg-card/5 hover:bg-card/10 transition-all"
                >
                    <X className="w-4 h-4" /> Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isPending ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
