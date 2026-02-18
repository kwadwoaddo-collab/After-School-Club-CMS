import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OnboardingForm from '@/components/onboarding/OnboardingForm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function OnboardingPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    // Check DB directly — session may be stale right after Google OAuth
    const dbUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        with: { organisation: true },
    });

    // If they already have a complete org, they don't need onboarding
    if (dbUser?.organisationId && (dbUser as any).organisation) {
        redirect('/dashboard');
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: '#05070A' }}>
            <OnboardingForm />
        </div>
    );
}
