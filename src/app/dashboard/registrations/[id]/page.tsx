import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import RegistrationStatusUpdater from './StatusUpdater';

const FUNDING_LABELS: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-300 border border-amber-400/20',
    approved: 'bg-green-500/20 text-green-300 border border-green-400/20',
    rejected: 'bg-red-500/20 text-red-300 border border-red-400/20',
};

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) redirect('/onboarding');

    const reg = await db.query.registrations.findFirst({
        where: and(eq(registrations.id, id), eq(registrations.organisationId, orgId)),
    });
    if (!reg) notFound();

    const kids = await db.select().from(registrationChildren).where(eq(registrationChildren.registrationId, id));
    const pars = await db.select().from(registrationParents).where(eq(registrationParents.registrationId, id));
    const primary = pars.find(p => p.isPrimary) ?? pars[0];

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Back + header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/registrations" className="text-white/40 hover:text-white text-sm transition-colors">
                    ← All Registrations
                </Link>
            </div>

            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Registration'}
                    </h1>
                    <p className="text-white/40 text-sm mt-1">
                        Submitted {new Date(reg.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_BADGE[reg.status]}`}>{reg.status}</span>
                    <RegistrationStatusUpdater registrationId={id} currentStatus={reg.status} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Children */}
                <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-white font-semibold mb-4">Children ({kids.length})</h2>
                    <div className="space-y-3">
                        {kids.map((k, i) => (
                            <div key={k.id} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                                <div>
                                    <p className="text-white font-medium">{k.submittedFirstName} {k.submittedLastName}</p>
                                    <p className="text-white/40 text-sm">{k.submittedSchoolYear}</p>
                                    {k.submittedDateOfBirth && (
                                        <p className="text-white/30 text-xs">DOB: {new Date(k.submittedDateOfBirth).toLocaleDateString('en-GB')}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    {k.wasMatched && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/20">Matched record</span>}
                                    {k.childId && (
                                        <Link href={`/dashboard/children/${k.childId}`} className="block text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors">
                                            View profile →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parents */}
                {pars.map((p, i) => (
                    <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-semibold mb-4">{p.isPrimary ? 'Primary ' : ''}Parent / Carer</h2>
                        <dl className="space-y-3 text-sm">
                            <DetailRow label="Name" value={`${p.submittedFirstName} ${p.submittedLastName}`} />
                            <DetailRow label="Relationship" value={p.submittedRelationship ?? '—'} />
                            <DetailRow label="Email" value={p.submittedEmail ?? '—'} />
                            <DetailRow label="Phone" value={p.submittedPhone ?? '—'} />
                            {p.wasMatched && <p className="text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded px-2 py-1">✓ Matched to existing parent record</p>}
                        </dl>
                    </div>
                ))}

                {/* Emergency Contact */}
                {reg.emergencyContactName && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-semibold mb-4">Emergency Contact</h2>
                        <dl className="space-y-3 text-sm">
                            <DetailRow label="Name" value={reg.emergencyContactName} />
                            <DetailRow label="Relationship" value={reg.emergencyContactRelationship ?? '—'} />
                            <DetailRow label="Phone" value={reg.emergencyContactPhone ?? '—'} />
                        </dl>
                    </div>
                )}

                {/* Funding & Registration details */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
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
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-white/40 flex-shrink-0">{label}</dt>
            <dd className="text-white text-right">{value}</dd>
        </div>
    );
}
