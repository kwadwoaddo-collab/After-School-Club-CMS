import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RegistrationTermsForm from './RegistrationTermsForm';
 
export const metadata = {
    title: 'Registration Settings',
};
 
export default async function RegistrationTermsSettingsPage() {
    const session = await auth();
 
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
 
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        return redirect('/dashboard');
    }
 
    return <RegistrationTermsForm />;
}
