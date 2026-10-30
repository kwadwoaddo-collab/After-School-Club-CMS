import JoiningJourneyGuide from '@/features/students/components/JoiningJourneyGuide';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents, organisations, centres, children, authorisedCollectors } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Building2, Check, ChevronLeft } from 'lucide-react';
import RegistrationStatusUpdater from './StatusUpdater';
import DownloadButton from './DownloadButton';
import EditRegistrationForm from './EditRegistrationForm';
import BackButton from './BackButton';
const FUNDING_LABELS: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    universal_credit: 'Universal Credit',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

const STATUS_BADGE: Record<string, string> = {
    awaiting_confirmation: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
    signed_up: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
    not_interested: 'bg-secondary text-muted-foreground border border-border',
};

const STATUS_LABEL: Record<string, string> = {
    awaiting_confirmation: 'Form received — awaiting confirmation',
    signed_up: 'Joining confirmed',
    not_interested: 'Not Interested',
};

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
 
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        notFound();
    }
 
    const session = await requireTenantSession();
    if (!session?.user) redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) redirect('/onboarding');
 
    const userRole = (session.user as any).role || 'TUTOR';
    if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
        redirect('/dashboard');
    }

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
    let centreAddress: string | null = null;
    let centrePhone: string | null = null;
    let centreEmail: string | null = null;
    let centreOfstedId: string | null = null;
    let centreSessionSlots: string[] | undefined;
    if (reg.centreId) {
        const centre = await db.query.centres.findFirst({
            where: eq(centres.id, reg.centreId),
            columns: {
                name: true,
                address: true,
                billingPhone: true,
                billingEmail: true,
                ofstedId: true,
                sessionSlots: true,
            },
        });
        if (centre) {
            centreName = centre.name;
            centreAddress = centre.address ?? null;
            centrePhone = centre.billingPhone ?? null;
            centreEmail = centre.billingEmail ?? null;
            centreOfstedId = centre.ofstedId ?? null;
            if (centre.sessionSlots) {
                try { centreSessionSlots = JSON.parse(centre.sessionSlots); } catch { /* ignore */ }
            }
        }
    }

    const kids = reg.registrationChildren;
    const pars = reg.registrationParents;
    const primary = pars.find(p => p.isPrimary) ?? pars[0];

    const linkedChildIds = kids
        .map(k => k.childId)
        .filter((cid): cid is string => Boolean(cid));

    const [linkedChildren, linkedCollectors] = linkedChildIds.length > 0
        ? await Promise.all([
            db.select().from(children).where(and(inArray(children.id, linkedChildIds), eq(children.organisationId, orgId))),
            db.select().from(authorisedCollectors).where(and(inArray(authorisedCollectors.childId, linkedChildIds), eq(authorisedCollectors.organisationId, orgId))),
        ])
        : [[], []];

    const childRecordMap = new Map(linkedChildren.map(c => [c.id, c]));
    const collectorsByChildId = new Map<string, typeof linkedCollectors>();
    for (const col of linkedCollectors) {
        const list = collectorsByChildId.get(col.childId) ?? [];
        list.push(col);
        collectorsByChildId.set(col.childId, list);
    }

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <JoiningJourneyGuide />
            {/* Back link */}
            <BackButton />

            {/* Header */}
            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl font-black text-foreground">
                            {primary ? (
                                primary.parentId ? (
                                    <Link
                                        href={`/dashboard/parents/${primary.parentId}`}
                                        className="hover:text-primary hover:underline underline-offset-4 transition-colors"
                                    >
                                        {primary.submittedFirstName} {primary.submittedLastName}
                                    </Link>
                                ) : (
                                    `${primary.submittedFirstName} ${primary.submittedLastName}`
                                )
                            ) : 'Registration'}
                        </h1>
                        {centreName && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                                <Building2 className="w-3.5 h-3.5" />
                                {centreName}
                                {centreOfstedId && <span className="text-primary/70 font-normal">· Ofsted: {centreOfstedId}</span>}
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        Submitted {new Date(reg.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                        centreAddress={centreAddress}
                        centrePhone={centrePhone}
                        centreEmail={centreEmail}
                        ofstedId={centreOfstedId}
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
                </div>
            </div>

            {/* Editable & read-only registration details */}
            <div className="space-y-6">
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

                {/* Safeguarding, Medical, Consents & Authorised Collectors */}
                {kids.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                        <div>
                            <h2 className="text-foreground font-bold text-base">Safeguarding, Medical, Consents &amp; Authorised Collectors</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Medical profile, safeguarding consents, and authorised collection contacts linked to each child.</p>
                        </div>
                        <div className="space-y-5">
                            {kids.map(k => {
                                const childRecord = k.childId ? childRecordMap.get(k.childId) : undefined;
                                const collectors = k.childId ? (collectorsByChildId.get(k.childId) ?? []) : [];
                                const allergiesText = childRecord?.allergies && childRecord.allergies.length > 0
                                    ? childRecord.allergies.join(', ')
                                    : 'None reported';

                                return (
                                    <div key={k.id} className="p-4 rounded-xl bg-secondary/20 border border-border space-y-4">
                                        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/60 pb-3">
                                            <div>
                                                {k.childId ? (
                                                    <Link
                                                        href={`/dashboard/students/${k.childId}`}
                                                        className="text-foreground font-bold hover:text-primary hover:underline transition-colors"
                                                    >
                                                        {k.submittedFirstName} {k.submittedLastName}
                                                    </Link>
                                                ) : (
                                                    <span className="text-foreground font-bold">{k.submittedFirstName} {k.submittedLastName}</span>
                                                )}
                                                {k.submittedSchoolYear && (
                                                    <span className="ml-2 text-xs text-muted-foreground">({k.submittedSchoolYear})</span>
                                                )}
                                            </div>
                                            {k.childId && (
                                                <Link
                                                    href={`/dashboard/students/${k.childId}#enrolment-follow-up`}
                                                    className="text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
                                                >
                                                    View Student Profile &amp; Enrolment →
                                                </Link>
                                            )}
                                        </div>

                                        {childRecord ? (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    <dl className="space-y-2">
                                                        <DetailRow label="Allergies" value={allergiesText} />
                                                        <DetailRow label="Dietary Requirements" value={childRecord.dietaryRequirements || 'None reported'} />
                                                        <DetailRow label="Medical Conditions" value={childRecord.medicalConditions || 'None reported'} />
                                                        <DetailRow label="Medication Notes" value={childRecord.medicationNotes || 'None reported'} />
                                                    </dl>
                                                    <dl className="space-y-2">
                                                        <DetailRow label="GP Name" value={childRecord.gpName || '—'} />
                                                        <DetailRow label="GP Phone" value={childRecord.gpPhone || '—'} />
                                                        <DetailRow label="SEN Details" value={childRecord.senDetails || (reg.hasSpecialNeeds ? (reg.specialNeedsDetails || 'Yes') : 'None reported')} />
                                                    </dl>
                                                </div>

                                                {/* Consents */}
                                                <div className="pt-2 border-t border-border/50">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consents</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${childRecord.photoConsent ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-secondary text-muted-foreground border-border'}`}>
                                                            Photo Consent: {childRecord.photoConsent ? 'Yes ✓' : 'No'}
                                                        </span>
                                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${childRecord.sunCreamConsent ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-secondary text-muted-foreground border-border'}`}>
                                                            Sun Cream: {childRecord.sunCreamConsent ? 'Yes ✓' : 'No'}
                                                        </span>
                                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${childRecord.firstAidConsent ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-secondary text-muted-foreground border-border'}`}>
                                                            Emergency First Aid: {childRecord.firstAidConsent ? 'Yes ✓' : 'No'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Authorised Collectors */}
                                                <div className="pt-2 border-t border-border/50">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                        Authorised Collectors ({collectors.length})
                                                    </p>
                                                    {collectors.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">No additional authorised collectors listed.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {collectors.map(col => (
                                                                <div key={col.id} className="p-3 rounded-lg bg-card border border-border text-xs space-y-1">
                                                                    <p className="font-bold text-foreground">{col.name} <span className="font-normal text-muted-foreground">({col.relationship})</span></p>
                                                                    {col.phone && <p className="text-muted-foreground">Phone: <span className="text-foreground font-medium">{col.phone}</span></p>}
                                                                    {col.collectionPassword && (
                                                                        <p className="text-muted-foreground">Password: <span className="text-foreground font-mono font-semibold">{col.collectionPassword}</span></p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">No linked student profile found for this registration entry.</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Signature */}
                {reg.parentSignature && (
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <h2 className="text-foreground font-bold mb-4">Parent Signature</h2>
                        {reg.parentSignature.startsWith('data:image/') ? (
                            <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                                <img
                                    src={reg.parentSignature}
                                    alt="Parent signature"
                                    className="max-h-24 max-w-xs object-contain"
                                />
                            </div>
                        ) : (
                            <div className="px-4 py-2.5 rounded-lg border border-border bg-secondary/40 font-serif italic text-lg text-foreground">
                                {reg.parentSignature}
                            </div>
                        )}
                        <p className="text-muted-foreground text-xs mt-2">Signed on {new Date(reg.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground flex-shrink-0">{label}</dt>
            <dd className="text-foreground text-right font-medium">{value}</dd>
        </div>
    );
}
