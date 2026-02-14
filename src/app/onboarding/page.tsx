import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OnboardingForm from '@/components/onboarding/OnboardingForm';

export default async function OnboardingPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.organisationId) {
        redirect('/dashboard');
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <OnboardingForm />
        </div>
    );
}
