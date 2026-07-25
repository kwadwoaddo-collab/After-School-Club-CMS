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
    const [isPending, startTransition] = useTransition();
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Editing states for sections
    const [editingSection, setEditingSection] = useState<string | null>(null);

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

    const handleCancel = (section: string) => {
        // We could selectively reset just that section, but for simplicity we reset all to initial props
        // In a perfect localized state we'd keep track of pre-edit state per section
        setStartDate(formatDateForInput(reg.startDate));
        setFundingType(reg.fundingTypes?.[0] || '');
        setFundingOther(reg.fundingOther || '');
        setEcName(reg.emergencyContactName || '');
        setEcRel(reg.emergencyContactRelationship || '');
        setEcPhone(reg.emergencyContactPhone || '');
        setHasSpecialNeeds(reg.hasSpecialNeeds ?? false);
        setSpecialNeedsDetails(reg.specialNeedsDetails || '');
        setParentsState(pars.map(p => ({
            id: p.id, parentId: p.parentId, isPrimary: p.isPrimary,
            firstName: p.submittedFirstName, lastName: p.submittedLastName,
            relationship: p.submittedRelationship || '', phone: p.submittedPhone || '', email: p.submittedEmail || '',
            addressLine1: p.parent?.addressLine1 || '', addressLine2: p.parent?.addressLine2 || '',
            city: p.parent?.city || '', postcode: p.parent?.postcode || '',
        })));
        setChildrenState(kids.map(k => ({
            id: k.id, childId: k.childId, firstName: k.submittedFirstName, lastName: k.submittedLastName,
            dateOfBirth: formatDateForInput(k.submittedDateOfBirth), schoolYear: k.submittedSchoolYear || '',
            sessions: k.submittedSessions || [],
        })));
        setError(null);
        setEditingSection(null);
    };

    const handleSave = (section: string) => {
        setError(null);
        setSuccess(null);
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
                setSuccess(section);
                setEditingSection(null);
                setTimeout(() => setSuccess(null), 3000);
            } catch (e: any) {
                setError(e.message || 'Failed to save changes');
            }
        });
    };

    const slots = centreSessionSlots || SESSION_SLOTS;

    const renderCardHeader = (title: string, sectionId: string) => (
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
            <div className="flex items-center gap-3">
                <h2 className="text-white font-bold">{title}</h2>
                {success === sectionId && <span className="text-emerald-400 text-xs flex items-center gap-1 animate-in fade-in"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>}
            </div>
            {editingSection !== sectionId ? (
                <button
                    onClick={() => { setEditingSection(sectionId); setError(null); setSuccess(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card/5 hover:bg-card/10 text-white/70 hover:text-white rounded-md border border-white/10 transition-all"
                >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleCancel(sectionId)} disabled={isPending} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white/60 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button onClick={() => handleSave(sectionId)} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors shadow-sm">
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="mt-6 space-y-6">
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Students & Sessions Card */}
            <div className={`glassmorphic-card rounded-2xl p-6 transition-all duration-300 ${editingSection === 'children' ? 'ring-1 ring-primary/50 bg-card/5' : ''}`}>
                {renderCardHeader('Students & Sessions', 'children')}
                <div className="space-y-6">
                    {childrenState.map((c, i) => (
                        <div key={c.id} className="border border-white/5 rounded-xl p-4 bg-card/2">
                            <p className="text-white/50 text-xs uppercase tracking-wide mb-3">Child {i + 1}</p>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className={label}>First Name</label>
                                    {editingSection === 'children' ? (
                                        <input className={input} value={c.firstName} onChange={e => updateChild(i, 'firstName', e.target.value)} />
                                    ) : (
                                        <p className="text-sm text-white/90">{c.firstName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className={label}>Last Name</label>
                                    {editingSection === 'children' ? (
                                        <input className={input} value={c.lastName} onChange={e => updateChild(i, 'lastName', e.target.value)} />
                                    ) : (
                                        <p className="text-sm text-white/90">{c.lastName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className={label}>Date of Birth</label>
                                    {editingSection === 'children' ? (
                                        <input type="date" className={input} value={c.dateOfBirth} onChange={e => updateChild(i, 'dateOfBirth', e.target.value)} />
                                    ) : (
                                        <p className="text-sm text-white/90">{c.dateOfBirth}</p>
                                    )}
                                </div>
                                <div>
                                    <label className={label}>Year Group</label>
                                    {editingSection === 'children' ? (
                                        <select className={input} value={c.schoolYear} onChange={e => updateChild(i, 'schoolYear', e.target.value)}>
                                            <option value="">Select year</option>
                                            {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    ) : (
                                        <p className="text-sm text-white/90">{c.schoolYear}</p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className={label}>Sessions</p>
                                {editingSection === 'children' ? (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                                        {slots.map(slot => (
                                            <label key={slot} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-all ${c.sessions.includes(slot) ? 'border-primary/50 bg-primary/10 text-white' : 'border-white/10 bg-card/3 text-white/50 hover:border-white/20'}`}>
                                                <input type="checkbox" checked={c.sessions.includes(slot)} onChange={() => toggleChildSession(i, slot)} className="w-3 h-3 accent-primary" />
                                                {slot}
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {c.sessions.length > 0 ? c.sessions.map(s => (
                                            <span key={s} className="px-2 py-1 bg-white/5 rounded text-xs text-white/80">{s}</span>
                                        )) : <span className="text-sm text-white/50">No sessions selected</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Parent Contact Card */}
            {parentsState.map((p, i) => (
                <div key={p.id} className={`glassmorphic-card rounded-2xl p-6 transition-all duration-300 ${editingSection === `parent-${i}` ? 'ring-1 ring-primary/50 bg-card/5' : ''}`}>
                    {renderCardHeader(`${p.isPrimary ? 'Primary ' : ''}Parent / Carer`, `parent-${i}`)}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={label}>First Name</label>
                                {editingSection === `parent-${i}` ? <input className={input} value={p.firstName} onChange={e => updateParent(i, 'firstName', e.target.value)} /> : <p className="text-sm text-white/90">{p.firstName}</p>}
                            </div>
                            <div>
                                <label className={label}>Last Name</label>
                                {editingSection === `parent-${i}` ? <input className={input} value={p.lastName} onChange={e => updateParent(i, 'lastName', e.target.value)} /> : <p className="text-sm text-white/90">{p.lastName}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={label}>Relationship</label>
                                {editingSection === `parent-${i}` ? (
                                    <select className={input} value={p.relationship} onChange={e => updateParent(i, 'relationship', e.target.value)}>
                                        <option value="">Select</option>
                                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                    </select>
                                ) : <p className="text-sm text-white/90 capitalize">{p.relationship}</p>}
                            </div>
                            <div>
                                <label className={label}>Phone</label>
                                {editingSection === `parent-${i}` ? <input className={input} value={p.phone} onChange={e => updateParent(i, 'phone', e.target.value)} /> : <p className="text-sm text-white/90">{p.phone}</p>}
                            </div>
                        </div>
                        <div>
                            <label className={label}>Email</label>
                            {editingSection === `parent-${i}` ? <input type="email" className={input} value={p.email} onChange={e => updateParent(i, 'email', e.target.value)} /> : <p className="text-sm text-white/90">{p.email}</p>}
                        </div>
                        
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-sm font-medium text-white/70 mb-3">Address</p>
                            {editingSection === `parent-${i}` ? (
                                <div className="space-y-3">
                                    <input className={input} value={p.addressLine1} onChange={e => updateParent(i, 'addressLine1', e.target.value)} placeholder="Address Line 1" />
                                    <input className={input} value={p.addressLine2} onChange={e => updateParent(i, 'addressLine2', e.target.value)} placeholder="Address Line 2" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input className={input} value={p.city} onChange={e => updateParent(i, 'city', e.target.value)} placeholder="City" />
                                        <input className={input} value={p.postcode} onChange={e => updateParent(i, 'postcode', e.target.value)} placeholder="Postcode" />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-white/80 leading-relaxed">
                                    {p.addressLine1}<br/>
                                    {p.addressLine2 && <>{p.addressLine2}<br/></>}
                                    {p.city}, {p.postcode}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* Medical & Special Needs Card */}
            <div className={`glassmorphic-card rounded-2xl p-6 transition-all duration-300 ${editingSection === 'medical' ? 'ring-1 ring-primary/50 bg-card/5' : ''}`}>
                {renderCardHeader('Medical & Special Needs', 'medical')}
                <div className="space-y-4">
                    <div>
                        <p className={label}>Has Special Needs / Medical Information?</p>
                        {editingSection === 'medical' ? (
                            <div className="flex gap-3 mt-2 mb-3">
                                {[{ v: false, l: 'No' }, { v: true, l: 'Yes' }].map(opt => (
                                    <button key={String(opt.v)} onClick={() => setHasSpecialNeeds(opt.v)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${hasSpecialNeeds === opt.v ? 'border-primary bg-primary/10 text-white' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-white/90 font-medium">{hasSpecialNeeds ? 'Yes' : 'No'}</p>
                        )}
                    </div>
                    {hasSpecialNeeds && (
                        <div>
                            <label className={label}>Details</label>
                            {editingSection === 'medical' ? (
                                <textarea className={`${input} min-h-[100px] resize-none`} value={specialNeedsDetails} onChange={e => setSpecialNeedsDetails(e.target.value)} placeholder="Describe conditions, allergies..." />
                            ) : (
                                <p className="text-sm text-white/80 whitespace-pre-wrap bg-white/5 p-3 rounded-lg border border-white/5">{specialNeedsDetails}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Funding & Emergency Contact Card */}
            <div className={`glassmorphic-card rounded-2xl p-6 transition-all duration-300 ${editingSection === 'funding_ec' ? 'ring-1 ring-primary/50 bg-card/5' : ''}`}>
                {renderCardHeader('Funding & Emergency Contact', 'funding_ec')}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-white/70 mb-2">Funding Details</h3>
                        <div>
                            <label className={label}>Requested Start Date</label>
                            {editingSection === 'funding_ec' ? <input type="date" className={input} value={startDate} onChange={e => setStartDate(e.target.value)} /> : <p className="text-sm text-white/90">{startDate}</p>}
                        </div>
                        <div>
                            <label className={label}>Funding Method</label>
                            {editingSection === 'funding_ec' ? (
                                <select className={input} value={fundingType} onChange={e => setFundingType(e.target.value)}>
                                    <option value="">Select funding</option>
                                    {FUNDING_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            ) : <p className="text-sm text-white/90">{FUNDING_OPTIONS.find(f => f.value === fundingType)?.label || fundingType}</p>}
                        </div>
                        {fundingType === 'other' && (
                            <div>
                                <label className={label}>Other Funding Details</label>
                                {editingSection === 'funding_ec' ? <input className={input} value={fundingOther} onChange={e => setFundingOther(e.target.value)} /> : <p className="text-sm text-white/90">{fundingOther}</p>}
                            </div>
                        )}
                    </div>
                    <div className="space-y-4 md:border-l md:border-white/5 md:pl-8">
                        <h3 className="text-sm font-medium text-white/70 mb-2">Emergency Contact</h3>
                        <div>
                            <label className={label}>Full Name</label>
                            {editingSection === 'funding_ec' ? <input className={input} value={ecName} onChange={e => setEcName(e.target.value)} /> : <p className="text-sm text-white/90">{ecName}</p>}
                        </div>
                        <div>
                            <label className={label}>Relationship</label>
                            {editingSection === 'funding_ec' ? <input className={input} value={ecRel} onChange={e => setEcRel(e.target.value)} /> : <p className="text-sm text-white/90">{ecRel}</p>}
                        </div>
                        <div>
                            <label className={label}>Phone</label>
                            {editingSection === 'funding_ec' ? <input className={input} value={ecPhone} onChange={e => setEcPhone(e.target.value)} /> : <p className="text-sm text-white/90">{ecPhone}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
