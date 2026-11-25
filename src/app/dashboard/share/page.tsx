import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { centres, organisations } from '@/db/schema';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { isValidUuid } from '@/lib/uuid';
import { getTrustedApplicationUrl } from '@/lib/base-url';
import FormsShareContent from '@/components/dashboard/FormsShareContent';
import { EmptyState } from '@/components/ui/EmptyState';
import { Share2 } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Share Portals & Embed Codes',
    description: 'Get your session booking and student registration links and embed codes to share with parents.',
};

export default async function SharePage(props: {
    searchParams?: Promise<{ centre?: string; centreId?: string }>;
} = {}) {
    const [{ session, user, organisationId }, resolvedParams] = await Promise.all([
        requireAuth({
            roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'],
            deniedRedirect: '/dashboard/attendance',
        }),
        props.searchParams ?? Promise.resolve({} as { centre?: string; centreId?: string }),
    ]);

    const isOwner = user.role === 'ORG_OWNER';
    let organisation: { id: string; name: string; slug: string; brandColor?: string | null } | undefined;
    let orgCentres: { id: string; name: string; slug: string }[] = [];

    if (isOwner) {
        const [orgRow, centreRows] = await Promise.all([
            db.query.organisations.findFirst({
                where: eq(organisations.id, organisationId),
                columns: { id: true, name: true, slug: true, brandColor: true },
            }),
            db.query.centres.findMany({
                where: eq(centres.organisationId, organisationId),
                columns: { id: true, name: true, slug: true },
                orderBy: [asc(centres.name)],
            }),
        ]);
        organisation = orgRow;
        orgCentres = centreRows ?? [];
    } else {
        const [orgRow, rawAccessibleIds] = await Promise.all([
            db.query.organisations.findFirst({
                where: eq(organisations.id, organisationId),
                columns: { id: true, name: true, slug: true, brandColor: true },
            }),
            getUserAccessibleCentreIds(session.user.id),
        ]);
        organisation = orgRow;
        if (!organisation) {
            redirect('/dashboard');
        }
        const accessibleCentreIds = rawAccessibleIds.filter(isValidUuid);
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
            columns: { id: true, name: true, slug: true },
            orderBy: [asc(centres.name)],
        })) ?? [];
    }

    if (!organisation) {
        redirect('/dashboard');
    }

    let initialCentreSlug = orgCentres.length === 1
        ? orgCentres[0].slug
        : (!isOwner && orgCentres.length > 0 ? orgCentres[0].slug : '');

    if (orgCentres.length > 0) {
        try {
            const activeCentreId = await resolveActiveCentreId(resolvedParams.centre ?? resolvedParams.centreId, orgCentres.map(c => c.id));
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
            baseUrl={getTrustedApplicationUrl()}
        />
    );
}
