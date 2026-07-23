/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import FormsShareContent from '@/components/dashboard/FormsShareContent';

export const metadata: Metadata = {
    title: 'Share Portals & Embed Codes',
    description: 'Get your session booking and student registration links and embed codes to share with parents.',
};

export default async function SharePage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

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

    // Exclude owners or managers if restricted, but anyone allowed in ROLE_NAV is safe
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        redirect('/dashboard');
    }

    return (
        <FormsShareContent 
            organisation={user.organisation} 
            centres={user.organisation.centres || []} 
        />
    );
}
