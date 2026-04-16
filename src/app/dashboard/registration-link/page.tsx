import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import RegistrationLinkContent from '@/components/dashboard/RegistrationLinkContent';

export const metadata: Metadata = {
    title: 'Registration Link & Embed Code',
    description: 'Get your registration form link and embed code to share with parents',
};

export default async function RegistrationLinkPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        with: {
            organisation: {
                with: {
                    centres: true
                }
            }
        },
    });

    if (!user?.organisation) {
        redirect('/dashboard');
    }

    return <RegistrationLinkContent organisation={user.organisation} centres={user.organisation.centres || []} />;
}
