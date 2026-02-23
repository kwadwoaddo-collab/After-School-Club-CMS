import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents, organisations } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import CopyRegistrationLink from '@/components/dashboard/CopyRegistrationLink';

const STATUS_BADGE: Record<string, string> = {
    awaiting_confirmation: 'bg-amber-100 text-amber-700 border border-amber-200',
    signed_up: 'bg-green-100 text-green-700 border border-green-200',
    not_interested: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const STATUS_LABEL: Record<string, string> = {
    awaiting_confirmation: 'Awaiting Confirmation',
    signed_up: 'Signed Up',
    not_interested: 'Not Interested',
};

export default async function RegistrationsPage() {
    const session = await auth();
    if (!session?.user) redirect('/login');

    const orgId = (session.user as any).organisationId;
    if (!orgId) redirect('/onboarding');

    // Fetch org slug for the registration link
    const [org] = await db
        .select({ slug: organisations.slug, name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';
    const registrationUrl = org ? `${baseUrl}/register/${org.slug}` : null;

    const rows = await db
        .select()
        .from(registrations)
        .where(eq(registrations.organisationId, orgId))
        .orderBy(desc(registrations.createdAt));

    const enriched = await Promise.all(rows.map(async r => {
        const kids = await db.select().from(registrationChildren).where(eq(registrationChildren.registrationId, r.id));
        const pars = await db.select().from(registrationParents).where(eq(registrationParents.registrationId, r.id));
        return { ...r, kids, pars };
    }));

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Registrations</h1>
                    <p className="text-slate-500 text-sm mt-1">{rows.length} total submission{rows.length !== 1 ? 's' : ''}</p>
                </div>
                {registrationUrl && (
                    <Link
                        href={registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Registration Form
                    </Link>
                )}
            </div>

            {/* Registration link card */}
            {registrationUrl && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Your Registration Link</p>
                        <p className="text-sm text-slate-700 font-mono truncate">{registrationUrl}</p>
                        <p className="text-xs text-slate-500 mt-1">Share this link with parents to let them register their children.</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <CopyRegistrationLink url={registrationUrl} />
                        <Link
                            href="/dashboard/settings/registration"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Edit T&amp;Cs
                        </Link>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {enriched.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-3xl">📋</div>
                    <h3 className="text-slate-700 font-semibold mb-2">No registrations yet</h3>
                    <p className="text-slate-400 text-sm max-w-sm mb-5">
                        Share your registration link with parents to start receiving submissions.
                    </p>
                    {registrationUrl && (
                        <Link
                            href={registrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                            Open Registration Form ↗
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {enriched.map(r => {
                        const primary = r.pars.find((p: any) => p.isPrimary) ?? r.pars[0];
                        const childNames = r.kids.map((k: any) => `${k.submittedFirstName} ${k.submittedLastName}`).join(', ');
                        return (
                            <Link key={r.id} href={`/dashboard/registrations/${r.id}`}
                                className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-sm transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <p className="text-slate-900 font-medium truncate">
                                                {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Unknown Parent'}
                                            </p>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] || ''}`}>
                                                {STATUS_LABEL[r.status] ?? r.status}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-sm truncate">
                                            {r.kids.length} child{r.kids.length !== 1 ? 'ren' : ''}: {childNames}
                                        </p>
                                        {primary?.submittedEmail && (
                                            <p className="text-slate-400 text-xs mt-1">{primary.submittedEmail}</p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-slate-400 text-xs">
                                            {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                        {r.startDate && (
                                            <p className="text-slate-400 text-xs mt-1">
                                                Start: {new Date(r.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
