import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DiscountsForm from './DiscountsForm';
 
export const metadata = {
    title: 'Discount Rules',
};
 
export default async function DiscountsPage() {
    const session = await auth();
 
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
 
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        return redirect('/dashboard');
    }
 
    return <DiscountsForm />;
}
