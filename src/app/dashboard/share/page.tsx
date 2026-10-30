import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import FormsShareContent from '@/components/dashboard/FormsShareContent';

export const metadata: Metadata = {
    title: 'Share Portals & Embed Codes',
    description: 'Get your session booking and student registration links and embed codes to share with parents.',
};

export default async function SharePage() {
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        with: {
            organisation: {
                with: {
                    centres: {
                        orderBy: (centres, { asc }) => [asc(centres.name)],
                    }
                }
            }
        },
    });

    if (!user?.organisation) {
        redirect('/dashboard');
    }

    const orgCentres = user.organisation.centres || [];
    let initialCentreSlug = orgCentres.length === 1 ? orgCentres[0].slug : '';
    try {
        const activeCentreId = await resolveActiveCentreId(undefined, orgCentres.map(c => c.id));
        if (activeCentreId !== 'all') {
            const matched = orgCentres.find(c => c.id === activeCentreId);
            if (matched?.slug) initialCentreSlug = matched.slug;
        }
    } catch {
        // Fallback when called outside request context
    }

    return (
        <FormsShareContent 
            organisation={user.organisation} 
            centres={orgCentres}
            initialCentreSlug={initialCentreSlug}
        />
    );
}
