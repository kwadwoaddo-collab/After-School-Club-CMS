import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';

const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-300 border border-amber-400/20',
    approved: 'bg-green-500/20 text-green-300 border border-green-400/20',
    rejected: 'bg-red-500/20 text-red-300 border border-red-400/20',
};

export default async function RegistrationsPage() {
    const session = await auth();
    if (!session?.user) redirect('/login');

    const orgId = (session.user as any).organisationId;
    if (!orgId) redirect('/onboarding');

    const rows = await db
        .select()
        .from(registrations)
        .where(eq(registrations.organisationId, orgId))
        .orderBy(desc(registrations.createdAt));

    // Fetch children + parents for each registration
    const enriched = await Promise.all(rows.map(async r => {
        const kids = await db.select().from(registrationChildren).where(eq(registrationChildren.registrationId, r.id));
        const pars = await db.select().from(registrationParents).where(eq(registrationParents.registrationId, r.id));
        return { ...r, kids, pars };
    }));

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Registrations</h1>
                    <p className="text-white/40 text-sm mt-1">{rows.length} total submission{rows.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {enriched.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-3xl">📋</div>
                    <h3 className="text-white font-semibold mb-2">No registrations yet</h3>
                    <p className="text-white/40 text-sm">Share your registration link with parents to start receiving submissions.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {enriched.map(r => {
                        const primary = r.pars.find(p => p.isPrimary) ?? r.pars[0];
                        const childNames = r.kids.map(k => `${k.submittedFirstName} ${k.submittedLastName}`).join(', ');
                        return (
                            <Link key={r.id} href={`/dashboard/registrations/${r.id}`}
                                className="block bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.07] transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <p className="text-white font-medium truncate">
                                                {primary ? `${primary.submittedFirstName} ${primary.submittedLastName}` : 'Unknown Parent'}
                                            </p>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[r.status]}`}>
                                                {r.status}
                                            </span>
                                        </div>
                                        <p className="text-white/40 text-sm truncate">
                                            {r.kids.length} child{r.kids.length !== 1 ? 'ren' : ''}: {childNames}
                                        </p>
                                        {primary?.submittedEmail && (
                                            <p className="text-white/30 text-xs mt-1">{primary.submittedEmail}</p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-white/40 text-xs">
                                            {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                        {r.startDate && (
                                            <p className="text-white/30 text-xs mt-1">
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
