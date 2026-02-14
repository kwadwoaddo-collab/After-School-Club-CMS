import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OnboardingForm from '@/components/onboarding/OnboardingForm';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function OnboardingPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.organisationId) {
        const org = await db.query.organisations.findFirst({
            where: eq(organisations.id, session.user.organisationId)
        });
        if (org) {
            redirect('/dashboard');
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <OnboardingForm />
        </div>
    );
}
