import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents, organisations, centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { Check } from 'lucide-react';
import RegistrationStatusUpdater from './StatusUpdater';
import DownloadButton from './DownloadButton';
import EditRegistrationForm from './EditRegistrationForm';

const FUNDING_LABELS: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    universal_credit: 'Universal Credit',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

const STATUS_BADGE: Record<string, string> = {
    awaiting_confirmation: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    signed_up: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    not_interested: 'bg-[#2a2d35] text-slate-400 border border-outline-variant/10',
};

const STATUS_LABEL: Record<string, string> = {
    awaiting_confirmation: 'Awaiting Confirmation',
    signed_up: 'Signed Up',
    not_interested: 'Not Interested',
};

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) redirect('/onboarding');

    const org = await db.query.organisations.findFirst({
        where: eq(organisations.id, orgId),
        columns: { name: true },
    });
    const orgName = org?.name || 'SprintScale';

    const reg = await db.query.registrations.findFirst({
        where: and(eq(registrations.id, id), eq(registrations.organisationId, orgId)),
        with: {
            registrationChildren: true,
            registrationParents: {
                with: {
                    parent: true,
                }
            },
        },
    });
    if (!reg) notFound();

    let centreName: string | null = null;
    let centreSessionSlots: string[] | undefined;
    if (reg.centreId) {
        const centre = await db.query.centres.findFirst({
            where: eq(centres.id, reg.centreId),
            columns: { name: true, sessionSlots: true },
        });
        if (centre) {
            centreName = centre.name;
            if (centre.sessionSlots) {
                try { centreSessionSlots = JSON.parse(centre.sessionSlots); } catch { /* ignore */ }
            }
        }
    }

    const kids = reg.registrationChildren;
    const pars = reg.registrationParents;
    const primary = pars.find(p => p.isPrimary) ?? pars[0];

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Back link */}
            <Link href="/dashboard/registrations" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-white text-sm transition-colors mb-8">
                ← All Registrations
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Registration'}
                    </h1>
                    <p className="text-on-surface-variant text-sm mt-1">
                        Submitted {new Date(reg.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {centreName && <span className="ml-2 text-white/30">· {centreName}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[reg.status] || ''}`}>
                        {STATUS_LABEL[reg.status] ?? reg.status}
                    </span>
                    <RegistrationStatusUpdater registrationId={id} currentStatus={reg.status as any} />
                    <DownloadButton
                        orgName={orgName}
                        centreName={centreName}
                        startDate={reg.startDate}
                        submittedAt={reg.submittedAt || reg.createdAt}
                        parents={pars.map(p => ({
                            firstName: p.submittedFirstName,
                            lastName: p.submittedLastName,
                            relationship: p.submittedRelationship || 'Parent',
                            phone: p.submittedPhone || '',
                            email: p.submittedEmail || undefined,
                            addressLine1: p.parent?.addressLine1 || undefined,
                            addressLine2: p.parent?.addressLine2 || undefined,
                            city: p.parent?.city || undefined,
                            postcode: p.parent?.postcode || undefined,
                        }))}
                        registeredChildren={kids.map(k => ({
                            firstName: k.submittedFirstName,
                            lastName: k.submittedLastName,
                            dateOfBirth: k.submittedDateOfBirth || '',
                            schoolYear: k.submittedSchoolYear || '',
                            sessions: k.submittedSessions || [],
                        }))}
                        emergencyContact={{
                            name: reg.emergencyContactName || 'Not specified',
                            relationship: reg.emergencyContactRelationship || 'Not specified',
                            phone: reg.emergencyContactPhone || 'Not specified',
                        }}
                        funding={{
                            type: reg.fundingTypes?.[0] || 'self_funded',
                            other: reg.fundingOther || undefined,
                        }}
                        specialNeeds={{
                            has: reg.hasSpecialNeeds ?? false,
                            details: reg.specialNeedsDetails || undefined,
                        }}
                        parentSignature={reg.parentSignature ?? null}
                    />
                    <EditRegistrationForm
                        reg={{
                            id: reg.id,
                            startDate: reg.startDate,
                            fundingTypes: reg.fundingTypes,
                            fundingOther: reg.fundingOther,
                            emergencyContactName: reg.emergencyContactName,
                            emergencyContactRelationship: reg.emergencyContactRelationship,
                            emergencyContactPhone: reg.emergencyContactPhone,
                            hasSpecialNeeds: reg.hasSpecialNeeds,
                            specialNeedsDetails: reg.specialNeedsDetails,
                        }}
                        pars={pars.map(p => ({
                            id: p.id,
                            parentId: p.parentId,
                            isPrimary: p.isPrimary,
                            submittedFirstName: p.submittedFirstName,
                            submittedLastName: p.submittedLastName,
                            submittedRelationship: p.submittedRelationship,
                            submittedPhone: p.submittedPhone,
                            submittedEmail: p.submittedEmail,
                            parent: p.parent ? {
                                addressLine1: p.parent.addressLine1,
                                addressLine2: p.parent.addressLine2,
                                city: p.parent.city,
                                postcode: p.parent.postcode,
                            } : null,
                        }))}
                        kids={kids.map(k => ({
                            id: k.id,
                            childId: k.childId,
                            submittedFirstName: k.submittedFirstName,
                            submittedLastName: k.submittedLastName,
                            submittedDateOfBirth: k.submittedDateOfBirth,
                            submittedSchoolYear: k.submittedSchoolYear,
                            submittedSessions: k.submittedSessions,
                        }))}
                        centreSessionSlots={centreSessionSlots}
                    />
                </div>
            </div>

            {/* Read-only detail cards — shown always for quick reference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Children */}
                <div className="md:col-span-2 bg-surface-container-high border border-outline-variant/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-white font-semibold mb-4">Children ({kids.length})</h2>
                    <div className="space-y-3">
                        {kids.map((k) => (
                            <div key={k.id} className="py-4 border-b border-outline-variant/10 last:border-0">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-white font-medium">{k.submittedFirstName} {k.submittedLastName}</p>
                                        <p className="text-on-surface-variant text-sm">{k.submittedSchoolYear}</p>
                                        {k.submittedDateOfBirth && (
                                            <p className="text-slate-400 text-xs mt-0.5">DOB: {new Date(k.submittedDateOfBirth).toLocaleDateString('en-GB')}</p>
                                        )}
                                        {k.submittedSessions && k.submittedSessions.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {k.submittedSessions.map(s => (
                                                    <span key={s} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{s}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {k.wasMatched && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 block mb-2">Matched record</span>
                                        )}
                                        {k.childId && (
                                            <Link href={`/dashboard/students/${k.childId}`} className="inline-block text-xs text-primary hover:text-blue-400 transition-colors">
                                                View profile →
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parents */}
                {pars.map((p) => (
                    <div key={p.id} className="bg-surface-container-high border border-outline-variant/10 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-white font-semibold mb-4">{p.isPrimary ? 'Primary ' : ''}Parent / Carer</h2>
                        <dl className="space-y-3 text-sm">
                            <DetailRow label="Name" value={`${p.submittedFirstName} ${p.submittedLastName}`} />
                            <DetailRow label="Relationship" value={p.submittedRelationship ?? '—'} />
                            <DetailRow label="Email" value={p.submittedEmail ?? '—'} />
                            <DetailRow label="Phone" value={p.submittedPhone ?? '—'} />
                            {p.parent?.addressLine1 && (
                                <DetailRow label="Address" value={[p.parent.addressLine1, p.parent.addressLine2, p.parent.city, p.parent.postcode].filter(Boolean).join(', ')} />
                            )}
                            {p.wasMatched && (
                                <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded px-2 py-1 mt-2 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Matched to existing parent record
                                </p>
                            )}
                        </dl>
                    </div>
                ))}

                {/* Emergency Contact */}
                <div className="bg-surface-container-high border border-outline-variant/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-white font-semibold mb-4">Emergency Contact</h2>
                    <dl className="space-y-3 text-sm">
                        <DetailRow label="Name" value={reg.emergencyContactName ?? '—'} />
                        <DetailRow label="Relationship" value={reg.emergencyContactRelationship ?? '—'} />
                        <DetailRow label="Phone" value={reg.emergencyContactPhone ?? '—'} />
                    </dl>
                </div>

                {/* Funding & Details */}
                <div className="bg-surface-container-high border border-outline-variant/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-white font-semibold mb-4">Funding &amp; Details</h2>
                    <dl className="space-y-3 text-sm">
                        <DetailRow label="Start Date" value={reg.startDate ? new Date(reg.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not specified'} />
                        <DetailRow label="Funding" value={reg.fundingTypes?.map(t => FUNDING_LABELS[t] ?? t).join(', ') || 'Not specified'} />
                        {reg.fundingOther && <DetailRow label="Funding (Other)" value={reg.fundingOther} />}
                        <DetailRow label="Special Needs" value={reg.hasSpecialNeeds ? 'Yes' : 'No'} />
                        {reg.specialNeedsDetails && <DetailRow label="Details" value={reg.specialNeedsDetails} />}
                        <DetailRow label="T&Cs Agreed" value={reg.termsAgreed ? 'Yes ✓' : 'No'} />
                    </dl>
                </div>

                {/* Signature */}
                {reg.parentSignature && (
                    <div className="bg-surface-container-high border border-outline-variant/10 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-white font-semibold mb-4">Parent Signature</h2>
                        <div className="bg-white rounded-xl p-4 border border-outline-variant/10">
                            <img
                                src={reg.parentSignature}
                                alt="Parent signature"
                                className="max-h-24 max-w-xs object-contain"
                            />
                        </div>
                        <p className="text-on-surface-variant text-xs mt-2">Signed on {new Date(reg.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                )}

            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-on-surface-variant flex-shrink-0">{label}</dt>
            <dd className="text-white text-right font-medium">{value}</dd>
        </div>
    );
}
