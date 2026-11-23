import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { centres, organisations } from '@/db/schema';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { isValidUuid } from '@/lib/uuid';
import FormsShareContent from '@/components/dashboard/FormsShareContent';
import { EmptyState } from '@/components/ui/EmptyState';
import { Share2 } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Share Portals & Embed Codes',
    description: 'Get your session booking and student registration links and embed codes to share with parents.',
};

export default async function SharePage() {
    const { session, user, organisationId } = await requireAuth({
        roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'],
        deniedRedirect: '/dashboard/attendance',
    });

    const organisation = await db.query.organisations.findFirst({
        where: eq(organisations.id, organisationId),
    });

    if (!organisation) {
        redirect('/dashboard');
    }

    const isOwner = user.role === 'ORG_OWNER';
    let orgCentres: { id: string; name: string; slug: string }[] = [];

    if (isOwner) {
        orgCentres = (await db.query.centres.findMany({
            where: eq(centres.organisationId, organisationId),
            orderBy: [asc(centres.name)],
        })) ?? [];
    } else {
        const accessibleCentreIds = (await getUserAccessibleCentreIds(session.user.id)).filter(isValidUuid);
        if (accessibleCentreIds.length === 0) {
            return (
                <div className="max-w-5xl mx-auto py-8">
                    <EmptyState
                        icon={<Share2 className="w-8 h-8" />}
                        title="No centres assigned"
                        description="You are not currently assigned to any centres. Ask an organisation owner to assign you to a centre to access its shareable booking and registration links."
                    />
                </div>
            );
        }

        orgCentres = (await db.query.centres.findMany({
            where: and(
                eq(centres.organisationId, organisationId),
                inArray(centres.id, accessibleCentreIds)
            ),
            orderBy: [asc(centres.name)],
        })) ?? [];
    }

    let initialCentreSlug = orgCentres.length === 1
        ? orgCentres[0].slug
        : (!isOwner && orgCentres.length > 0 ? orgCentres[0].slug : '');

    if (orgCentres.length > 0) {
        try {
            const activeCentreId = await resolveActiveCentreId(undefined, orgCentres.map(c => c.id));
            if (activeCentreId !== 'all') {
                const matched = orgCentres.find(c => c.id === activeCentreId);
                if (matched?.slug) initialCentreSlug = matched.slug;
            }
        } catch {
            // Fallback when called outside request context
        }
    }

    return (
        <FormsShareContent
            organisation={organisation}
            centres={orgCentres}
            initialCentreSlug={initialCentreSlug}
        />
    );
}
