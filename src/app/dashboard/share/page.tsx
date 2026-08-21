import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
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

    return (
        <FormsShareContent 
            organisation={user.organisation} 
            centres={user.organisation.centres || []} 
        />
    );
}
