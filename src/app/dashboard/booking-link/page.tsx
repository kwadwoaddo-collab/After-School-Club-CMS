import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users, organisations, centres } from '@/db/schema';
import BookingLinkContent from '@/components/dashboard/BookingLinkContent';

export const metadata: Metadata = {
    title: 'Booking Link & Embed Code',
    description: 'Get your booking link and embed code to add to your website',
};

export default async function BookingLinkPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    // Get user with organization
    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        with: {
            organisation: true,
        },
    });

    if (!user?.organisation) {
        redirect('/dashboard');
    }

    // Get organization's centres
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, user.organisation.id),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    return (
        <BookingLinkContent
            organisation={user.organisation}
            centres={orgCentres}
        />
    );
}
